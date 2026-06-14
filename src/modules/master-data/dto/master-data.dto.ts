export class ProvinceDto {
  code: string;
  parent_code: string;
  bps_code: string;
  name: string;
}

export class CityDto {
  code: string;
  parent_code: string;
  bps_code: string;
  name: string;
}

export class DistrictDto {
  code: string;
  parent_code: string;
  bps_code: string;
  name: string;
}

export class SubDistrictDto {
  code: string;
  parent_code: string;
  bps_code: string;
  name: string;
}

export class MasterDataResponseDto<T> {
  status: number;
  error: boolean;
  message: string;
  data: T[];
}
