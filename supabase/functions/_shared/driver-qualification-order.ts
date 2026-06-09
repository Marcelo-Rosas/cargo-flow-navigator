export function normalizePlate(plate: string): string {
  return plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

type FleetDriver = {
  name?: string | null;
  cpf?: string | null;
  cnh?: string | null;
  cnh_category?: string | null;
  cnh_expiry?: string | null;
  antt?: string | null;
  contract_type?: string | null;
  rntrc_registry_type?: string | null;
};

type FleetOwner = {
  name?: string | null;
  cpf_cnpj?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
};

type FleetVehicle = {
  plate: string;
  plate_2?: string | null;
  renavam?: string | null;
  brand?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  drivers?: FleetDriver | FleetDriver[] | null;
  owners?: FleetOwner | FleetOwner[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function enrichOrderForDriverQualification(
  sb: { from: (table: string) => any },
  order: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const rawPlate = order.vehicle_plate;
  if (typeof rawPlate !== 'string' || !rawPlate.trim()) return order;

  const plateNorm = normalizePlate(rawPlate);
  const { data: vehicles, error } = await sb
    .from('vehicles')
    .select(
      `plate, plate_2, renavam, brand, model, year, color,
       drivers(name, cpf, cnh, cnh_category, cnh_expiry, antt, contract_type, rntrc_registry_type),
       owners(name, cpf_cnpj, city, state, phone)`
    )
    .or(`plate.ilike.${plateNorm},plate_2.ilike.${plateNorm}`)
    .limit(5);

  if (error || !vehicles?.length) return order;

  const vehicle =
    (vehicles as FleetVehicle[]).find(
      (v) => normalizePlate(v.plate) === plateNorm || normalizePlate(v.plate_2 ?? '') === plateNorm
    ) ?? (vehicles as FleetVehicle[])[0];

  const driver = firstRelation(vehicle.drivers);
  const owner = firstRelation(vehicle.owners);

  return {
    ...order,
    fleet_matched: true,
    vehicle_plate_2: vehicle.plate_2 ?? null,
    vehicle_renavam: vehicle.renavam ?? null,
    fleet_brand: vehicle.brand ?? order.vehicle_brand ?? null,
    fleet_model: vehicle.model ?? order.vehicle_model ?? null,
    fleet_year: vehicle.year ?? null,
    fleet_color: vehicle.color ?? null,
    driver_cpf: driver?.cpf ?? order.driver_cpf ?? null,
    driver_cnh_category: driver?.cnh_category ?? null,
    driver_cnh_expiry: driver?.cnh_expiry ?? null,
    driver_contract_type: driver?.contract_type ?? null,
    driver_rntrc_registry_type: driver?.rntrc_registry_type ?? null,
    driver_name: order.driver_name || driver?.name || null,
    driver_cnh: order.driver_cnh || driver?.cnh || null,
    driver_antt: order.driver_antt || driver?.antt || null,
    owner_name: order.owner_name || owner?.name || null,
    owner_phone: order.owner_phone || owner?.phone || null,
    owner_cpf_cnpj: owner?.cpf_cnpj ?? null,
    owner_city: owner?.city ?? null,
    owner_state: owner?.state ?? null,
  };
}
