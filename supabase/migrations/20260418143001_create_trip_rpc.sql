-- Trips must be created only via this RPC: validates minimum fields before calling generate_trip_number.
CREATE OR REPLACE FUNCTION public.create_trip(
  p_vehicle_plate text,
  p_driver_id uuid,
  p_vehicle_type_id uuid DEFAULT NULL,
  p_departure_at timestamptz DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_trip_number text DEFAULT NULL
)
RETURNS public.trips
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.trips%ROWTYPE;
  v_plate text;
  v_num text;
BEGIN
  v_plate := trim(coalesce(p_vehicle_plate, ''));
  IF v_plate = '' THEN
    RAISE EXCEPTION 'vehicle_plate_required';
  END IF;
  IF p_driver_id IS NULL THEN
    RAISE EXCEPTION 'driver_id_required';
  END IF;

  IF p_trip_number IS NOT NULL AND btrim(p_trip_number) <> '' THEN
    v_num := btrim(p_trip_number);
  ELSE
    v_num := generate_trip_number();
  END IF;

  INSERT INTO public.trips (
    trip_number,
    vehicle_plate,
    driver_id,
    vehicle_type_id,
    departure_at,
    notes,
    status_operational,
    financial_status
  )
  VALUES (
    v_num,
    v_plate,
    p_driver_id,
    p_vehicle_type_id,
    p_departure_at,
    p_notes,
    'aberta',
    'open'
  )
  RETURNING * INTO r;

  RETURN r;
END;
$$;

REVOKE ALL ON FUNCTION public.create_trip(text, uuid, uuid, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_trip(text, uuid, uuid, timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_trip(text, uuid, uuid, timestamptz, text, text) TO service_role;
