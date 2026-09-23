import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@googlemaps/google-maps-services-js';

export interface GeocodedAddress {
  lat: number;
  lng: number;
  formattedAddress: string;
}

/** Google Maps geocoding behind a small interface, so tests can stub it. */
@Injectable()
export class GeocodingService {
  private readonly client = new Client();
  private readonly key: string;

  constructor(configService: ConfigService) {
    this.key = configService.getOrThrow('GOOGLE_API_KEY');
  }

  async geocode(address: string): Promise<GeocodedAddress> {
    const response = await this.client.geocode({
      params: { address, key: this.key },
    });
    const result = response.data.results[0];
    if (!result) {
      throw new Error('address not found');
    }
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      formattedAddress: result.formatted_address,
    };
  }
}
