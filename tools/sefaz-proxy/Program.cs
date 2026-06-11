using System.Net;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;

var jsonOpts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

var builder = WebApplication.CreateBuilder(args);

var port = int.TryParse(Environment.GetEnvironmentVariable("SEFAZ_PROXY_PORT"), out var p) ? p : 3333;
var secret = Environment.GetEnvironmentVariable("SEFAZ_PROXY_SECRET") ?? "dev-secret-change-me";
var cnpjFilter = (Environment.GetEnvironmentVariable("VECTRA_CNPJ") ?? "59650913000104").Replace(".", "").Replace("/", "").Replace("-", "");
var tpAmb = Environment.GetEnvironmentVariable("SEFAZ_TP_AMB") ?? "1";

builder.WebHost.UseUrls($"http://127.0.0.1:{port}");

var app = builder.Build();

app.Use(async (ctx, next) =>
{
    ctx.Response.Headers.Append("Access-Control-Allow-Origin", "*");
    ctx.Response.Headers.Append("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    ctx.Response.Headers.Append("Access-Control-Allow-Headers", "Content-Type, X-Sefaz-Proxy-Secret");
    if (ctx.Request.Method == HttpMethods.Options)
    {
        ctx.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }
    await next();
});

app.MapGet("/health", () => Results.Json(new { ok = true, service = "sefaz-proxy" }));

app.MapPost("/v1/consult", async (HttpContext ctx) =>
{
    if (!ctx.Request.Headers.TryGetValue("X-Sefaz-Proxy-Secret", out var hdr) || hdr != secret)
    {
        return Results.Json(new { error = "Não autorizado" }, statusCode: StatusCodes.Status401Unauthorized);
    }

    ConsultRequest? body;
    try
    {
        body = await JsonSerializer.DeserializeAsync<ConsultRequest>(ctx.Request.Body, jsonOpts);
    }
    catch
    {
        return Results.Json(new { error = "JSON inválido" }, statusCode: StatusCodes.Status400BadRequest);
    }

    var chave = Regex.Replace(body?.Chave ?? "", @"\D", "");
    if (chave.Length != 44)
    {
        return Results.Json(new { error = "Chave deve ter 44 dígitos" }, statusCode: StatusCodes.Status400BadRequest);
    }

    try
    {
        var cert = FindCertificate(cnpjFilter);
        if (cert is null)
        {
            return Results.Json(
                new { error = $"Certificado A1 com CNPJ {cnpjFilter} não encontrado no Windows (CurrentUser\\My)" },
                statusCode: StatusCodes.Status503ServiceUnavailable
            );
        }

        var modelo = chave.Substring(20, 2);
        var ufCode = chave.Substring(0, 2);
        var endpoint = ResolveEndpoint(modelo, ufCode, tpAmb);
        var soapBody = BuildSoapEnvelope(modelo, chave, tpAmb);
        var soapResponse = await PostSoapAsync(endpoint, soapBody, cert);
        var parsed = ParseSoapResponse(soapResponse);

        return Results.Json(new
        {
            chave,
            tipo = MapTipo(modelo),
            status_sefaz = parsed.CStat,
            status_descricao = parsed.XMotivo,
            protocolo = parsed.Protocolo,
            data_autorizacao = parsed.DataAutorizacao,
            emitente = parsed.Emitente,
            destinatario = parsed.Destinatario,
        });
    }
    catch (Exception ex)
    {
        return Results.Json(new { error = ex.Message }, statusCode: StatusCodes.Status502BadGateway);
    }
});

app.Run();

static X509Certificate2? FindCertificate(string cnpjDigits)
{
    using var store = new X509Store(StoreName.My, StoreLocation.CurrentUser);
    store.Open(OpenFlags.ReadOnly);
    return store.Certificates
        .Cast<X509Certificate2>()
        .Where(c => c.HasPrivateKey && !string.IsNullOrEmpty(c.Subject))
        .OrderByDescending(c => c.NotAfter)
        .FirstOrDefault(c =>
            c.Subject.Contains(cnpjDigits, StringComparison.OrdinalIgnoreCase) ||
            c.Subject.Contains(FormatCnpj(cnpjDigits), StringComparison.OrdinalIgnoreCase));
}

static string FormatCnpj(string digits)
{
    if (digits.Length != 14) return digits;
    return $"{digits[..2]}.{digits[2..5]}.{digits[5..8]}/{digits[8..12]}-{digits[12..14]}";
}

static string ResolveEndpoint(string modelo, string ufCode, string tpAmb)
{
    if (modelo == "57")
        return "https://cte.svrs.rs.gov.br/ws/cteConsultaV4/cteConsultaV4.asmx";
    if (modelo == "58")
        return "https://mdfe.svrs.rs.gov.br/ws/MDFeConsulta/MDFeConsulta.asmx";

    var homolog = tpAmb == "2";

    // NF-e: endpoint da SEFAZ autorizadora (2 primeiros dígitos da chave = UF)
    return ufCode switch
    {
        "35" => homolog
            ? "https://homologacao.nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx"
            : "https://nfe.fazenda.sp.gov.br/ws/nfeconsultaprotocolo4.asmx",
        "31" => homolog
            ? "https://hnfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4"
            : "https://nfe.fazenda.mg.gov.br/nfe2/services/NFeConsultaProtocolo4",
        "41" or "42" or "43" or "50" or "51" or "52" or "12" or "27" or "16" or "53" or "32" or "25" or "33"
            or "24" or "11" or "14" or "28" or "17" or "21" or "15" or "22" or "13" =>
            "https://nfe.svrs.rs.gov.br/ws/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx",
        _ => homolog
            ? "https://hom.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx"
            : "https://www.sefazvirtual.fazenda.gov.br/NFeConsultaProtocolo4/NFeConsultaProtocolo4.asmx",
    };
}

static string MapTipo(string modelo) => modelo switch
{
    "57" => "cte",
    "58" => "mdfe",
    _ => "nfe",
};

static string BuildSoapEnvelope(string modelo, string chave, string tpAmb)
{
    // SEFAZ rejeita cStat 588 se houver whitespace/quebras entre tags — XML compacto, uma linha.
    if (modelo == "57")
    {
        var consSit = $"<consSitCTe xmlns=\"http://www.portalfiscal.inf.br/cte\" versao=\"4.00\"><tpAmb>{tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chCTe>{chave}</chCTe></consSitCTe>";
        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
            + "<soap12:Envelope xmlns:soap12=\"http://www.w3.org/2003/05/soap-envelope\"><soap12:Body>"
            + "<cteDadosMsg xmlns=\"http://www.portalfiscal.inf.br/cte/wsdl/CteConsultaV4\">"
            + consSit
            + "</cteDadosMsg></soap12:Body></soap12:Envelope>";
    }

    if (modelo == "58")
    {
        var consSit = $"<consSitMDFe xmlns=\"http://www.portalfiscal.inf.br/mdfe\" versao=\"3.00\"><tpAmb>{tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chMDFe>{chave}</chMDFe></consSitMDFe>";
        return "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
            + "<soap12:Envelope xmlns:soap12=\"http://www.w3.org/2003/05/soap-envelope\"><soap12:Body>"
            + "<mdfeDadosMsg xmlns=\"http://www.portalfiscal.inf.br/mdfe/wsdl/MDFeConsulta\">"
            + consSit
            + "</mdfeDadosMsg></soap12:Body></soap12:Envelope>";
    }

    var consSitNFe = $"<consSitNFe xmlns=\"http://www.portalfiscal.inf.br/nfe\" versao=\"4.00\"><tpAmb>{tpAmb}</tpAmb><xServ>CONSULTAR</xServ><chNFe>{chave}</chNFe></consSitNFe>";
    return "<?xml version=\"1.0\" encoding=\"utf-8\"?>"
        + "<soap12:Envelope xmlns:soap12=\"http://www.w3.org/2003/05/soap-envelope\"><soap12:Body>"
        + "<nfeDadosMsg xmlns=\"http://www.portalfiscal.inf.br/nfe/wsdl/NFeConsultaProtocolo4\">"
        + consSitNFe
        + "</nfeDadosMsg></soap12:Body></soap12:Envelope>";
}

static async Task<string> PostSoapAsync(string endpoint, string soapXml, X509Certificate2 cert)
{
    using var handler = new HttpClientHandler();
    handler.ClientCertificates.Add(cert);
    handler.ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator;

    using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(30) };
    using var content = new StringContent(soapXml, Encoding.UTF8, "application/soap+xml");
    using var response = await client.PostAsync(endpoint, content);
    var body = await response.Content.ReadAsStringAsync();
    if (!response.IsSuccessStatusCode)
    {
        throw new InvalidOperationException($"SEFAZ HTTP {(int)response.StatusCode}: {body[..Math.Min(body.Length, 300)]}");
    }
    return body;
}

static ParsedSefaz ParseSoapResponse(string soapXml)
{
    var doc = XDocument.Parse(soapXml);
    var cStat = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "cStat")?.Value ?? "000";
    var xMotivo = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "xMotivo")?.Value ?? "";
    var protocolo = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "nProt")?.Value;
    var dataAutorizacao = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "dhRecbto")?.Value;

    Party? emitente = null;
    Party? destinatario = null;

    var emit = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "emit");
    if (emit is not null)
    {
        emitente = new Party(
            emit.Descendants().FirstOrDefault(e => e.Name.LocalName is "CNPJ" or "Cnpj")?.Value,
            emit.Descendants().FirstOrDefault(e => e.Name.LocalName == "xNome")?.Value
        );
    }

    var dest = doc.Descendants().FirstOrDefault(e => e.Name.LocalName == "dest");
    if (dest is not null)
    {
        destinatario = new Party(
            dest.Descendants().FirstOrDefault(e => e.Name.LocalName is "CNPJ" or "Cnpj")?.Value,
            dest.Descendants().FirstOrDefault(e => e.Name.LocalName == "xNome")?.Value
        );
    }

    return new ParsedSefaz(cStat, xMotivo, protocolo, dataAutorizacao, emitente, destinatario);
}

record ConsultRequest(string? Chave);
record Party(string? Cnpj, string? Nome);
record ParsedSefaz(string CStat, string XMotivo, string? Protocolo, string? DataAutorizacao, Party? Emitente, Party? Destinatario);
