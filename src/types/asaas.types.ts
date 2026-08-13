export type AsaasBillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD';

export type AsaasCycle = 'MONTHLY' | 'YEARLY' | 'WEEKLY' | 'BIWEEKLY' | 'QUARTERLY' | 'SEMIANNUALLY';

export interface AsaasCustomerParams {
    name: string;
    email: string;
    cpfCnpj?: string;
    phone?: string;
    mobilePhone?: string;
    postalCode?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    province?: string;
    externalReference?: string;
    notificationDisabled?: boolean;
}

export interface AsaasCustomerResponse {
    id: string;
    name: string;
    email: string;
    cpfCnpj?: string;
    phone?: string;
    mobilePhone?: string;
    dateCreated: string;
}

export interface AsaasCreditCard {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
}

export interface AsaasCreditCardHolderInfo {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    addressComplement?: string;
    phone: string;
    mobilePhone?: string;
}

export interface AsaasSubscriptionParams {
    customerId: string;
    billingType: AsaasBillingType;
    value: number;
    cycle: AsaasCycle;
    description: string;
    nextDueDate?: string;
    creditCard?: AsaasCreditCard;
    creditCardHolderInfo?: AsaasCreditCardHolderInfo;
}

export interface AsaasSubscriptionResponse {
    id: string;
    customer: string;
    value: number;
    netValue?: number;
    billingType: AsaasBillingType;
    cycle: AsaasCycle;
    status: string;
    description?: string;
    nextDueDate?: string;
    dateCreated: string;
}

export interface AsaasOneTimePaymentParams {
    customerId: string;
    billingType: AsaasBillingType;
    value: number;
    description: string;
    dueDate?: string;
    externalReference?: string;
    creditCard?: AsaasCreditCard;
    creditCardHolderInfo?: AsaasCreditCardHolderInfo;
}

export interface AsaasPaymentResponse {
    id: string;
    customer: string;
    subscription?: string;
    value: number;
    netValue?: number;
    billingType: AsaasBillingType;
    status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH' | 'REFUND_REQUESTED' | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE' | 'AWAITING_CHARGEBACK_REVERSAL' | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS';
    dueDate: string;
    paymentDate?: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    description?: string;
    externalReference?: string;
}

export interface AsaasPixQrCodeResponse {
    encodedImage: string; // Base64 string para o QR Code em Imagem
    payload: string;      // Código Copia e Cola Pix
    expirationDate: string;
}

export interface AsaasWebhookPayload {
    event: 
        | 'PAYMENT_CREATED'
        | 'PAYMENT_UPDATED'
        | 'PAYMENT_CONFIRMED'
        | 'PAYMENT_RECEIVED'
        | 'PAYMENT_OVERDUE'
        | 'PAYMENT_DELETED'
        | 'PAYMENT_RESTORED'
        | 'PAYMENT_REFUNDED'
        | 'PAYMENT_RECEIVED_IN_CASH_UNDONE'
        | 'PAYMENT_CHARGEBACK_REQUESTED'
        | 'PAYMENT_CHARGEBACK_DISPUTE'
        | 'PAYMENT_AWAITING_CHARGEBACK_REVERSAL'
        | 'PAYMENT_DUNNING_RECEIVED'
        | 'PAYMENT_DUNNING_REQUESTED'
        | 'PAYMENT_BANK_SLIP_VIEWED'
        | 'PAYMENT_CHECKOUT_VIEWED';
    payment: AsaasPaymentResponse;
}
