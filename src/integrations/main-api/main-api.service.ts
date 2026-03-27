import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { ChatEligibilityRequest } from './interfaces/chat-eligibility-request.interface';
import { ChatEligibilityResponse } from './interfaces/chat-eligibility-response.interface';

@Injectable()
export class MainApiService {
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('MAIN_API_BASE_URL') || '';

    if (!this.baseUrl) {
      throw new Error('MAIN_API_BASE_URL no está definido');
    }
  }

  async checkChatEligibility(
    payload: ChatEligibilityRequest,
  ): Promise<ChatEligibilityResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<ChatEligibilityResponse>(
          `${this.baseUrl}/internal/chat/eligibility`,
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      console.error('=== ERROR API PRINCIPAL ===');
      console.error('URL:', `${this.baseUrl}/internal/chat/eligibility`);
      console.error('PAYLOAD:', payload);
      console.error('STATUS:', axiosError.response?.status);
      console.error('DATA:', axiosError.response?.data);
      console.error('MESSAGE:', axiosError.message);
      console.error('===========================');

      throw new InternalServerErrorException(
        'No fue posible validar la elegibilidad del chat con la API principal',
      );
    }
  }
}
