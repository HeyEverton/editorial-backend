import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import {
    AsaasCustomerParams,
    AsaasCustomerResponse,
    AsaasSubscriptionParams,
    AsaasSubscriptionResponse,
    AsaasOneTimePaymentParams,
    AsaasPaymentResponse,
    AsaasPixQrCodeResponse
} from '../types/asaas.types.js';

dotenv.config();

export class AsaasPaymentService {
    private client: AxiosInstance;

    constructor() {
        const apiKey = process.env.ASAAS_API_KEY || '';
        const environment = process.env.ASAAS_ENVIRONMENT || 'sandbox';

        const baseURL = environment === 'production'
            ? 'https://www.asaas.com/api/v3'
            : 'https://sandbox.asaas.com/api/v3';

        this.client = axios.create({
            baseURL,
            headers: {
                'access_token': apiKey,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });
    }

    /**
     * Busca um cliente existente por CPF/CNPJ ou e-mail, ou cria um novo cliente no Asaas.
     */
    async getOrCreateCustomer(params: AsaasCustomerParams): Promise<AsaasCustomerResponse> {
        try {
            const cleanCpf = params.cpfCnpj ? params.cpfCnpj.replace(/\D/g, '') : undefined;
            let searchResponse;

            if (cleanCpf) {
                searchResponse = await this.client.get('/customers', { params: { cpfCnpj: cleanCpf } });
            } else {
                searchResponse = await this.client.get('/customers', { params: { email: params.email } });
            }

            if (searchResponse.data?.data && searchResponse.data.data.length > 0) {
                const customer = searchResponse.data.data[0];
                return {
                    id: customer.id,
                    name: customer.name,
                    email: customer.email,
                    cpfCnpj: customer.cpfCnpj,
                    phone: customer.phone || customer.mobilePhone,
                    dateCreated: customer.dateCreated
                };
            }

            const createResponse = await this.client.post('/customers', {
                name: params.name,
                email: params.email,
                cpfCnpj: cleanCpf || undefined,
                mobilePhone: params.phone ? params.phone.replace(/\D/g, '') : undefined,
                notificationDisabled: false,
            });

            return {
                id: createResponse.data.id,
                name: createResponse.data.name,
                email: createResponse.data.email,
                cpfCnpj: createResponse.data.cpfCnpj,
                phone: createResponse.data.mobilePhone,
                dateCreated: createResponse.data.dateCreated,
            };
        } catch (error: any) {
            console.error('[AsaasPaymentService] Erro ao obter/criar cliente:', error?.response?.data || error.message);
            const detailMessage = error?.response?.data?.errors?.[0]?.description || error.message;
            throw new Error(`Falha no cadastro do cliente no Asaas: ${detailMessage}`);
        }
    }

    /**
     * Cria uma assinatura recorrente no Asaas.
     */
    async createSubscription(params: AsaasSubscriptionParams): Promise<AsaasSubscriptionResponse> {
        try {
            const nextDueDate = params.nextDueDate || new Date().toISOString().split('T')[0];

            const payload: any = {
                customer: params.customerId,
                billingType: params.billingType,
                value: params.value,
                cycle: params.cycle,
                description: params.description,
                nextDueDate,
            };

            if (params.billingType === 'CREDIT_CARD') {
                if (!params.creditCard || !params.creditCardHolderInfo) {
                    throw new Error('Dados do cartão e titular são obrigatórios para pagamentos via cartão de crédito');
                }
                payload.creditCard = params.creditCard;
                payload.creditCardHolderInfo = params.creditCardHolderInfo;
            }

            const response = await this.client.post<AsaasSubscriptionResponse>('/subscriptions', payload);
            return response.data;
        } catch (error: any) {
            console.error('[AsaasPaymentService] Erro ao criar assinatura:', error?.response?.data || error.message);
            const detailMessage = error?.response?.data?.errors?.[0]?.description || error.message;
            throw new Error(`Falha ao criar assinatura no Asaas: ${detailMessage}`);
        }
    }

    /**
     * Cancela uma assinatura ativa no Asaas.
     */
    async cancelSubscription(subscriptionId: string): Promise<{ id: string; deleted: boolean }> {
        try {
            const response = await this.client.delete(`/subscriptions/${subscriptionId}`);
            return response.data;
        } catch (error: any) {
            console.error('[AsaasPaymentService] Erro ao cancelar assinatura:', error?.response?.data || error.message);
            const detailMessage = error?.response?.data?.errors?.[0]?.description || error.message;
            throw new Error(`Falha ao cancelar assinatura no Asaas: ${detailMessage}`);
        }
    }

    /**
     * Cria uma cobrança avulsa (ex: Pix instantâneo).
     */
    async createOneTimePayment(params: AsaasOneTimePaymentParams): Promise<AsaasPaymentResponse> {
        try {
            const dueDate = params.dueDate || new Date().toISOString().split('T')[0];

            const payload: any = {
                customer: params.customerId,
                billingType: params.billingType,
                value: params.value,
                dueDate,
                description: params.description,
                externalReference: params.externalReference,
            };

            if (params.billingType === 'CREDIT_CARD') {
                if (!params.creditCard || !params.creditCardHolderInfo) {
                    throw new Error('Dados do cartão e titular são obrigatórios para pagamentos via cartão de crédito');
                }
                payload.creditCard = params.creditCard;
                payload.creditCardHolderInfo = params.creditCardHolderInfo;
            }

            const response = await this.client.post<AsaasPaymentResponse>('/payments', payload);
            return response.data;
        } catch (error: any) {
            console.error('[AsaasPaymentService] Erro ao criar cobrança:', error?.response?.data || error.message);
            const detailMessage = error?.response?.data?.errors?.[0]?.description || error.message;
            throw new Error(`Falha ao criar cobrança no Asaas: ${detailMessage}`);
        }
    }

    /**
     * Obtém o QR Code em base64 e a chave Copia e Cola Pix para uma cobrança.
     */
    async getPaymentPixQrCode(paymentId: string): Promise<AsaasPixQrCodeResponse> {
        try {
            const response = await this.client.get<AsaasPixQrCodeResponse>(`/payments/${paymentId}/pixQrCode`);
            return {
                encodedImage: response.data.encodedImage,
                payload: response.data.payload,
                expirationDate: response.data.expirationDate,
            };
        } catch (error: any) {
            console.error('[AsaasPaymentService] Erro ao obter QR Code Pix:', error?.response?.data || error.message);
            const detailMessage = error?.response?.data?.errors?.[0]?.description || error.message;
            throw new Error(`Falha ao obter QR Code Pix: ${detailMessage}`);
        }
    }

    /**
     * Lista cobranças geradas para uma assinatura.
     */
    async getSubscriptionPayments(subscriptionId: string): Promise<AsaasPaymentResponse[]> {
        try {
            const response = await this.client.get<{ data: AsaasPaymentResponse[] }>(`/subscriptions/${subscriptionId}/payments`);
            return response.data?.data || [];
        } catch (error: any) {
            console.error('[AsaasPaymentService] Erro ao buscar pagamentos da assinatura:', error?.response?.data || error.message);
            throw new Error(`Falha ao consultar pagamentos da assinatura no Asaas`);
        }
    }

    /**
     * Consulta os detalhes e o status atualizado de uma cobrança específica.
     */
    async getPaymentDetails(paymentId: string): Promise<AsaasPaymentResponse> {
        try {
            const response = await this.client.get<AsaasPaymentResponse>(`/payments/${paymentId}`);
            return response.data;
        } catch (error: any) {
            console.error('[AsaasPaymentService] Erro ao consultar pagamento:', error?.response?.data || error.message);
            const detailMessage = error?.response?.data?.errors?.[0]?.description || error.message;
            throw new Error(`Falha ao consultar pagamento no Asaas: ${detailMessage}`);
        }
    }
}

export const asaasService = new AsaasPaymentService();
