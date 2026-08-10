import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { generateUlid } from '../lib/ulid.js';
import { asaasService } from '../services/asaas.service.js';

export const subscribePlan = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const {
            planId,
            billingCycle = 'mensal',
            billingType,
            cpf,
            phone,
            creditCard,
            creditCardHolderInfo
        } = req.body;

        if (!planId || !billingType) {
            return res.status(400).json({ error: 'Parâmetros obrigatórios incompletos (planId, billingType)' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { plan: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const plan = await prisma.plan.findUnique({
            where: { id: planId }
        });

        if (!plan) {
            return res.status(404).json({ error: 'Plano não encontrado' });
        }

        const userCpf = cpf || user.cpf;
        const userPhone = phone || user.phone;

        if (billingType === 'BOLETO' && !userCpf) {
            return res.status(400).json({ error: 'CPF/CNPJ é obrigatório para emissão de Boleto' });
        }

        // 1. Criar/Obter Cliente no Asaas
        const customer = await asaasService.getOrCreateCustomer({
            name: user.name || user.email.split('@')[0],
            email: user.email,
            cpfCnpj: userCpf || undefined,
            phone: userPhone || undefined
        });

        // Atualiza o CPF/Telefone no banco local se foi informado agora
        if (userCpf || userPhone || customer.id) {
            await prisma.user.update({
                where: { id: userId },
                data: {
                    cpf: userCpf || user.cpf,
                    phone: userPhone || user.phone,
                    asaasCustomerId: customer.id
                }
            });
        }

        // 2. Definir valor e ciclo
        const isAnual = billingCycle.toLowerCase() === 'anual';
        const value = isAnual ? plan.priceAnual : plan.priceMensal;
        const cycle = isAnual ? 'YEARLY' : 'MONTHLY';

        if (value <= 0) {
            // Plano Gratuito / Free
            await prisma.user.update({
                where: { id: userId },
                data: {
                    planId: plan.id,
                    billingCycle: 'mensal',
                    subscriptionStatus: 'ACTIVE',
                    asaasSubscriptionId: null
                }
            });

            return res.json({
                message: 'Plano gratuito ativado com sucesso',
                plan,
                subscriptionStatus: 'ACTIVE'
            });
        }

        // 3. Criar Assinatura no Asaas
        const description = `Assinatura Plano ${plan.name} (${isAnual ? 'Anual' : 'Mensal'}) - Editorial Architect`;
        const subscription = await asaasService.createSubscription({
            customerId: customer.id,
            billingType,
            value,
            cycle,
            description,
            creditCard,
            creditCardHolderInfo
        });

        // 4. Buscar cobrança gerada para a assinatura inicial
        const payments = await asaasService.getSubscriptionPayments(subscription.id);
        const initialPayment = payments.length > 0 ? payments[0] : null;

        let pixQrCode = null;
        if (billingType === 'PIX' && initialPayment) {
            try {
                pixQrCode = await asaasService.getPaymentPixQrCode(initialPayment.id);
            } catch (err) {
                console.error('Erro ao obter QR Code Pix:', err);
            }
        }

        // 5. Atualizar usuário e salvar histórico no BD
        await prisma.user.update({
            where: { id: userId },
            data: {
                planId: plan.id,
                billingCycle: isAnual ? 'anual' : 'mensal',
                asaasSubscriptionId: subscription.id,
                subscriptionStatus: 'PENDING'
            }
        });

        if (initialPayment) {
            await prisma.paymentTransaction.create({
                data: {
                    id: generateUlid(),
                    userId,
                    asaasPaymentId: initialPayment.id,
                    asaasSubscriptionId: subscription.id,
                    value: initialPayment.value,
                    netValue: initialPayment.netValue || null,
                    billingType: initialPayment.billingType,
                    status: initialPayment.status,
                    pixQrCodeUrl: pixQrCode?.encodedImage || null,
                    pixCopyPaste: pixQrCode?.payload || null,
                    bankSlipUrl: initialPayment.bankSlipUrl || null,
                    invoiceUrl: initialPayment.invoiceUrl || null,
                    description,
                    dueDate: initialPayment.dueDate ? new Date(initialPayment.dueDate) : null
                }
            });
        }

        return res.json({
            message: 'Assinatura criada com sucesso',
            subscriptionId: subscription.id,
            paymentId: initialPayment?.id,
            billingType,
            status: initialPayment?.status || 'PENDING',
            pixQrCode: pixQrCode ? {
                encodedImage: pixQrCode.encodedImage,
                payload: pixQrCode.payload,
                expirationDate: pixQrCode.expirationDate
            } : null,
            bankSlipUrl: initialPayment?.bankSlipUrl || null,
            invoiceUrl: initialPayment?.invoiceUrl || null
        });
    } catch (error: any) {
        console.error('[PaymentController] Erro no checkout:', error);
        return res.status(500).json({
            error: 'Erro ao processar assinatura',
            details: error.message
        });
    }
};

export const getSubscriptionStatus = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                plan: true,
                paymentTransactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 5
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        return res.json({
            plan: user.plan,
            billingCycle: user.billingCycle,
            subscriptionStatus: user.subscriptionStatus,
            subscriptionDueDate: user.subscriptionDueDate,
            asaasSubscriptionId: user.asaasSubscriptionId,
            recentPayments: user.paymentTransactions
        });
    } catch (error: any) {
        console.error('[PaymentController] Erro ao buscar status:', error);
        return res.status(500).json({ error: 'Erro ao buscar detalhes da assinatura' });
    }
};

export const cancelUserSubscription = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user || !user.asaasSubscriptionId) {
            return res.status(400).json({ error: 'Nenhuma assinatura ativa encontrada para cancelamento' });
        }

        await asaasService.cancelSubscription(user.asaasSubscriptionId);

        await prisma.user.update({
            where: { id: userId },
            data: {
                subscriptionStatus: 'CANCELED'
            }
        });

        return res.json({ message: 'Assinatura cancelada com sucesso' });
    } catch (error: any) {
        console.error('[PaymentController] Erro ao cancelar assinatura:', error);
        return res.status(500).json({ error: 'Erro ao cancelar assinatura', details: error.message });
    }
};

export const handleWebhook = async (req: Request, res: Response) => {
    try {
        const webhookToken = req.headers['asaas-access-token'];
        const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN;

        if (configuredToken && webhookToken !== configuredToken) {
            console.warn('[Webhook Asaas] Token de acesso inválido no webhook');
            return res.status(401).json({ error: 'Token de webhook inválido' });
        }

        const { event, payment } = req.body;
        console.log(`[Webhook Asaas] Evento recebido: ${event}`, payment?.id);

        if (!payment) {
            return res.status(200).json({ received: true });
        }

        // Buscar transação vinculada ou usuário vinculado ao cliente Asaas
        let transaction = await prisma.paymentTransaction.findUnique({
            where: { asaasPaymentId: payment.id }
        });

        let user = null;
        if (transaction) {
            user = await prisma.user.findUnique({ where: { id: transaction.userId } });
        } else if (payment.customer) {
            user = await prisma.user.findUnique({ where: { asaasCustomerId: payment.customer } });
        }

        if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
            const dueDate = payment.paymentDate
                ? new Date(payment.paymentDate)
                : new Date();
            
            // Adiciona 30 dias (ou 365 se for anual) à validade do plano
            const isAnual = user?.billingCycle === 'anual';
            const nextDueDate = new Date(dueDate);
            nextDueDate.setDate(nextDueDate.getDate() + (isAnual ? 365 : 30));

            if (user) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        subscriptionStatus: 'ACTIVE',
                        subscriptionDueDate: nextDueDate
                    }
                });
            }

            if (transaction) {
                await prisma.paymentTransaction.update({
                    where: { id: transaction.id },
                    data: {
                        status: 'RECEIVED',
                        netValue: payment.netValue || null,
                        paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date()
                    }
                });
            } else if (user) {
                await prisma.paymentTransaction.create({
                    data: {
                        id: generateUlid(),
                        userId: user.id,
                        asaasPaymentId: payment.id,
                        asaasSubscriptionId: payment.subscription || null,
                        value: payment.value,
                        netValue: payment.netValue || null,
                        billingType: payment.billingType,
                        status: 'RECEIVED',
                        description: payment.description || 'Cobrança confirmada pelo Asaas',
                        paymentDate: payment.paymentDate ? new Date(payment.paymentDate) : new Date()
                    }
                });
            }
        } else if (event === 'PAYMENT_OVERDUE') {
            if (user) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { subscriptionStatus: 'OVERDUE' }
                });
            }

            if (transaction) {
                await prisma.paymentTransaction.update({
                    where: { id: transaction.id },
                    data: { status: 'OVERDUE' }
                });
            }
        } else if (event === 'PAYMENT_REFUNDED') {
            if (transaction) {
                await prisma.paymentTransaction.update({
                    where: { id: transaction.id },
                    data: { status: 'REFUNDED' }
                });
            }
        }

        return res.status(200).json({ received: true });
    } catch (error: any) {
        console.error('[PaymentController] Erro ao processar webhook:', error);
        return res.status(500).json({ error: 'Erro interno ao processar webhook' });
    }
};
