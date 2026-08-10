import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface AsaasCustomerParams {
    name: string;
    email: string;
    cpfCnpj?: string;
    phone?: string;
}

export interface AsaasSubscriptionParams {
    customerId: string;
    billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
    value: number;
    cycle: 'MONTHLY' | 'YEARLY';
    description: string;
    creditCard?: {
        holderName: string;
        number: string;
        expiryMonth: string;
        expiryYear: string;
        ccv: string;
    };
    creditCardHolderInfo?: {
        name: string;
        email: string;
        cpfCnpj: string;
        postalCode: string;
        addressNumber: string;
        phone: string;
        mobilePhone?: string;
    };
}

export interface AsaasOneTimePaymentParams {
    customerId: string;
    billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
    value: number;
    description: string;
    dueDate?: string;
    creditCard?: AsaasSubscriptionParams['creditCard'];
    creditCardHolderInfo?: AsaasSubscriptionParams['creditCardHolderInfo'];
}

export class AsaasService {
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
        });
    }

    /**
     * Busca ou cria um cliente no Asaas pelo CPF/CNPJ ou e-mail.
     */
    async getOrCreateCustomer(params: AsaasCustomerParams): Promise<{ id: string; name: string; email: string }> {
        try {
            let response;
            if (params.cpfCnpj) {
                response = await this.client.get('/customers', { params: { cpfCnpj: params.cpfCnpj } });
            } else {
                response = await this.client.get('/customers', { params: { email: params.email } });
            }

            if (response.data?.data && response.data.data.length > 0) {
                const customer = response.data.data[0];
                return { id: customer.id, name: customer.name, email: customer.email };
            }

            const createResponse = await this.client.post('/customers', {
                name: params.name,
                email: params.email,
                cpfCnpj: params.cpfCnpj || undefined,
                mobilePhone: params.phone || undefined,
                notificationDisabled: false,
            });

            return {
                id: createResponse.data.id,
                name: createResponse.data.name,
                email: createResponse.data.email,
            };
        } catch (error: any) {
            console.error('[AsaasService] Erro ao obter/criar cliente:', error?.response?.data || error.message);
            throw new Error(`Falha no cadastro de cliente no Asaas: ${JSON.stringify(error?.response?.data?.errors || error.message)}`);
        }
    }

    /**
     * Cria uma assinatura recorrente de plano.
     */
    async createSubscription(params: AsaasSubscriptionParams) {
        try {
            const nextDueDate = new Date();
            nextDueDate.setDate(nextDueDate.getDate() + 1);

            const payload: any = {
                customer: params.customerId,
                billingType: params.billingType,
                value: params.value,
                cycle: params.cycle,
                description: params.description,
                nextDueDate: nextDueDate.toISOString().split('T')[0],
            };

            if (params.billingType === 'CREDIT_CARD') {
                if (!params.creditCard || !params.creditCardHolderInfo) {
                    throw new Error('Dados do cartão e do titular são obrigatórios para pagamento via Cartão de Crédito');
                }
                payload.creditCard = params.creditCard;
                payload.creditCardHolderInfo = params.creditCardHolderInfo;
            }

            const response = await this.client.post('/subscriptions', payload);
            return response.data;
        } catch (error: any) {
            console.error('[AsaasService] Erro ao criar assinatura:', error?.response?.data || error.message);
            throw new Error(`Falha ao criar assinatura no Asaas: ${JSON.stringify(error?.response?.data?.errors || error.message)}`);
        }
    }

    /**
     * Cancela uma assinatura ativa.
     */
    async cancelSubscription(subscriptionId: string) {
        try {
            const response = await this.client.delete(`/subscriptions/${subscriptionId}`);
            return response.data;
        } catch (error: any) {
            console.error('[AsaasService] Erro ao cancelar assinatura:', error?.response?.data || error.message);
            throw new Error(`Falha ao cancelar assinatura no Asaas: ${JSON.stringify(error?.response?.data?.errors || error.message)}`);
        }
    }

    /**
     * Cria uma cobrança avulsa (Pix, Boleto ou Cartão).
     */
    async createOneTimePayment(params: AsaasOneTimePaymentParams) {
        try {
            const dueDate = params.dueDate || new Date().toISOString().split('T')[0];

            const payload: any = {
                customer: params.customerId,
                billingType: params.billingType,
                value: params.value,
                dueDate,
                description: params.description,
            };

            if (params.billingType === 'CREDIT_CARD') {
                if (!params.creditCard || !params.creditCardHolderInfo) {
                    throw new Error('Dados do cartão e do titular são obrigatórios para pagamento via Cartão de Crédito');
                }
                payload.creditCard = params.creditCard;
                payload.creditCardHolderInfo = params.creditCardHolderInfo;
            }

            const response = await this.client.post('/payments', payload);
            return response.data;
        } catch (error: any) {
            console.error('[AsaasService] Erro ao criar cobrança avulsa:', error?.response?.data || error.message);
            throw new Error(`Falha ao criar cobrança no Asaas: ${JSON.stringify(error?.response?.data?.errors || error.message)}`);
        }
    }

    /**
     * Obtém o QR Code e chave Pix Copia e Cola para uma cobrança.
     */
    async getPaymentPixQrCode(paymentId: string) {
        try {
            const response = await this.client.get(`/payments/${paymentId}/pixQrCode`);
            return {
                encodedImage: response.data.encodedImage,
                payload: response.data.payload,
                expirationDate: response.data.expirationDate,
            };
        } catch (error: any) {
            console.error('[AsaasService] Erro ao obter QR Code Pix:', error?.response?.data || error.message);
            throw new Error(`Falha ao obter Pix QR Code: ${JSON.stringify(error?.response?.data?.errors || error.message)}`);
        }
    }

    /**
     * Lista cobranças associadas a uma assinatura.
     */
    async getSubscriptionPayments(subscriptionId: string) {
        try {
            const response = await this.client.get(`/subscriptions/${subscriptionId}/payments`);
            return response.data?.data || [];
        } catch (error: any) {
            console.error('[AsaasService] Erro ao buscar pagamentos da assinatura:', error?.response?.data || error.message);
            throw new Error(`Falha ao consultar pagamentos da assinatura no Asaas`);
        }
    }

    /**
     * Consulta detalhes de uma cobrança específica.
     */
    async getPaymentDetails(paymentId: string) {
        try {
            const response = await this.client.get(`/payments/${paymentId}`);
            return response.data;
        } catch (error: any) {
            console.error('[AsaasService] Erro ao consultar pagamento:', error?.response?.data || error.message);
            throw new Error(`Falha ao consultar pagamento no Asaas`);
        }
    }
}

export const asaasService = new AsaasService();
