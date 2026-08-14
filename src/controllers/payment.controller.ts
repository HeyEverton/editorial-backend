import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { generateUlid } from '../lib/ulid.js';
import { asaasService } from '../services/asaas.service.js';
import { validateCPF, validateEmail, sanitizeString } from '../lib/validators.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

/**
 * Cria/Obtém um cliente no Asaas.
 */
export const createAsaasCustomer = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { name, email, cpf, phone } = req.body;

        const cleanEmail = sanitizeString(email);
        const cleanName = sanitizeString(name);
        const cleanCpf = cpf ? cpf.replace(/\D/g, '') : undefined;
        const cleanPhone = phone ? phone.replace(/\D/g, '') : undefined;

        if (cleanCpf && !validateCPF(cleanCpf)) {
            return res.status(400).json({ error: 'CPF informado é inválido' });
        }

        if (cleanEmail && !validateEmail(cleanEmail)) {
            return res.status(400).json({ error: 'E-mail informado é inválido' });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const customer = await asaasService.getOrCreateCustomer({
            name: cleanName || user.name || user.email.split('@')[0],
            email: cleanEmail || user.email,
            cpfCnpj: cleanCpf || user.cpf || undefined,
            phone: cleanPhone || user.phone || undefined,
        });

        await prisma.user.update({
            where: { id: userId },
            data: {
                asaasCustomerId: customer.id,
                cpf: cleanCpf || user.cpf,
                phone: cleanPhone || user.phone,
            }
        });

        return res.json({
            message: 'Cliente Asaas configurado com sucesso',
            customer
        });
    } catch (error: any) {
        console.error('[PaymentController] Erro ao criar cliente Asaas:', error);
        return res.status(500).json({
            error: 'Erro ao processar cadastro de cliente no gateway',
            message: error.message
        });
    }
};

/**
 * Processa a assinatura e gera cobrança Pix / Cartão / Boleto.
 */
export const subscribePlan = async (req: Request, res: Response) => {
    try {
        let userId = (req as any).user?.id;
        const {
            planId,
            billingCycle = 'mensal',
            billingType = 'PIX',
            name,
            email,
            cpf,
            phone,
            creditCard,
            creditCardHolderInfo
        } = req.body;

        if (!planId || !billingType) {
            return res.status(400).json({ error: 'Parâmetros obrigatórios incompletos (planId, billingType)' });
        }

        const userEmail = sanitizeString(email);
        const userName = sanitizeString(name) || userEmail.split('@')[0];
        const userCpf = cpf ? cpf.replace(/\D/g, '') : null;
        const userPhone = phone ? phone.replace(/\D/g, '') : null;

        let user = null;
        if (userId) {
            user = await prisma.user.findUnique({
                where: { id: userId },
                include: { plan: true }
            });
        }

        if (!user && userEmail) {
            user = await prisma.user.findUnique({
                where: { email: userEmail },
                include: { plan: true }
            });
        }

        if (!user) {
            if (!userEmail) {
                return res.status(400).json({ error: 'E-mail é obrigatório para registrar a assinatura' });
            }
            if (!validateEmail(userEmail)) {
                return res.status(400).json({ error: 'E-mail informado é inválido' });
            }

            const dummyHash = await bcrypt.hash(generateUlid(), 10);
            user = await prisma.user.create({
                data: {
                    id: generateUlid(),
                    name: userName,
                    email: userEmail,
                    passwordHash: dummyHash,
                    cpf: userCpf,
                    phone: userPhone
                },
                include: { plan: true }
            });
        }

        userId = user.id;

        let plan = await prisma.plan.findUnique({
            where: { id: planId }
        });

        if (!plan) {
            plan = await prisma.plan.findUnique({
                where: { slug: planId }
            });
        }

        if (!plan) {
            return res.status(404).json({ error: 'Plano não encontrado' });
        }

        const finalCpf = userCpf || user.cpf;
        const finalEmail = userEmail || user.email;
        const finalName = userName || user.name || finalEmail.split('@')[0];
        const finalPhone = userPhone || user.phone;

        // Validação de entrada no backend
        if (billingType === 'PIX' || billingType === 'BOLETO') {
            if (!finalCpf) {
                return res.status(400).json({ error: 'CPF é obrigatório para pagamentos via Pix ou Boleto' });
            }
            if (!validateCPF(finalCpf)) {
                return res.status(400).json({ error: 'CPF informado é inválido' });
            }
        }

        if (!validateEmail(finalEmail)) {
            return res.status(400).json({ error: 'E-mail informado é inválido' });
        }

        // 1. Criar/Obter Cliente no Asaas
        const customer = await asaasService.getOrCreateCustomer({
            name: finalName,
            email: finalEmail,
            cpfCnpj: finalCpf || undefined,
            phone: finalPhone || undefined
        });

        // Atualizar dados do usuário no banco MySQL
        await prisma.user.update({
            where: { id: userId },
            data: {
                name: finalName,
                email: finalEmail,
                cpf: finalCpf,
                phone: finalPhone,
                asaasCustomerId: customer.id
            }
        });

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
        const description = `Assinatura Plano ${plan.name} (${isAnual ? 'Anual' : 'Mensal'}) - Arquitetura Editorial`;
        
        const finalHolderInfo = billingType === 'CREDIT_CARD' ? {
            name: userName,
            email: userEmail,
            cpfCnpj: userCpf || '',
            postalCode: '01001-000',
            addressNumber: '100',
            phone: userPhone || '11999999999',
            ...creditCardHolderInfo
        } : undefined;

        const subscription = await asaasService.createSubscription({
            customerId: customer.id,
            billingType,
            value,
            cycle,
            description,
            creditCard,
            creditCardHolderInfo: finalHolderInfo
        });

        // 4. Buscar cobrança gerada para a assinatura inicial
        const payments = await asaasService.getSubscriptionPayments(subscription.id);
        const initialPayment = payments.length > 0 ? payments[0] : null;

        let pixQrCode = null;
        if (billingType === 'PIX' && initialPayment) {
            try {
                pixQrCode = await asaasService.getPaymentPixQrCode(initialPayment.id);
            } catch (err) {
                console.error('[PaymentController] Erro ao gerar QR Code Pix:', err);
            }
        }

        // 5. Atualizar usuário e registrar transação localmente
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
            await prisma.paymentTransaction.upsert({
                where: { asaasPaymentId: initialPayment.id },
                update: {
                    status: initialPayment.status,
                    pixQrCodeUrl: pixQrCode?.encodedImage || null,
                    pixCopyPaste: pixQrCode?.payload || null,
                },
                create: {
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

        const userToken = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        return res.json({
            message: 'Assinatura e cobrança geradas com sucesso',
            subscriptionId: subscription.id,
            paymentId: initialPayment?.id,
            billingType,
            status: initialPayment?.status || 'PENDING',
            token: userToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
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
            error: 'Erro ao processar cobrança/assinatura',
            message: error.message
        });
    }
};

/**
 * Polling Endpoint: Retorna o status de um pagamento e atualiza o banco local se necessário.
 * Rota: GET /api/payments/:id/status
 */
export const getPaymentStatus = async (req: Request, res: Response) => {
    try {
        const paymentId = String(req.params.id);
        const userId = (req as any).user?.id;

        if (!paymentId) {
            return res.status(400).json({ error: 'ID de pagamento não informado' });
        }

        // 1. Buscar transação local no MySQL
        let transaction = await prisma.paymentTransaction.findUnique({
            where: { asaasPaymentId: paymentId }
        });

        // 2. Se não encontrou ou o status local ainda é PENDING, consultar API do Asaas
        let currentStatus = transaction?.status || 'PENDING';
        let paymentDetails: any = null;

        if (!transaction || currentStatus === 'PENDING') {
            try {
                paymentDetails = await asaasService.getPaymentDetails(paymentId);
                currentStatus = paymentDetails.status;

                // Se o status mudou para pago (RECEIVED ou CONFIRMED)
                if (currentStatus === 'RECEIVED' || currentStatus === 'CONFIRMED') {
                    const paymentDate = paymentDetails.paymentDate ? new Date(paymentDetails.paymentDate) : new Date();

                    if (transaction) {
                        await prisma.paymentTransaction.update({
                            where: { id: transaction.id },
                            data: {
                                status: 'RECEIVED',
                                netValue: paymentDetails.netValue || null,
                                paymentDate
                            }
                        });
                    }

                    // Atualizar usuário se for do mesmo usuário
                    const targetUserId = transaction?.userId || userId;
                    if (targetUserId) {
                        const user = await prisma.user.findUnique({ where: { id: targetUserId } });
                        const isAnual = user?.billingCycle === 'anual';
                        const nextDueDate = new Date(paymentDate);
                        nextDueDate.setDate(nextDueDate.getDate() + (isAnual ? 365 : 30));

                        await prisma.user.update({
                            where: { id: targetUserId },
                            data: {
                                subscriptionStatus: 'ACTIVE',
                                subscriptionDueDate: nextDueDate
                            }
                        });
                    }
                }
            } catch (err: any) {
                console.warn(`[PaymentController] Polling no Asaas falhou para ${paymentId}:`, err.message);
            }
        }

        const isPaid = currentStatus === 'RECEIVED' || currentStatus === 'CONFIRMED' || currentStatus === 'RECEIVED_IN_CASH';

        return res.json({
            id: paymentId,
            status: currentStatus,
            isPaid,
            paymentDate: paymentDetails?.paymentDate || transaction?.paymentDate || null,
            pixQrCodeUrl: transaction?.pixQrCodeUrl || null,
            pixCopyPaste: transaction?.pixCopyPaste || null,
        });
    } catch (error: any) {
        console.error('[PaymentController] Erro no polling de pagamento:', error);
        return res.status(500).json({ error: 'Erro ao verificar status do pagamento' });
    }
};

/**
 * Obtém o status completo da assinatura do usuário autenticado.
 */
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

/**
 * Cancela a assinatura do usuário.
 */
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
        return res.status(500).json({ error: 'Erro ao cancelar assinatura', message: error.message });
    }
};

/**
 * Webhook Asaas: Recebe notificações de eventos de pagamento (PAYMENT_RECEIVED, PAYMENT_CONFIRMED, etc.)
 * Rotas: POST /api/webhooks/asaas ou POST /api/payments/webhook
 */
export const handleWebhook = async (req: Request, res: Response) => {
    try {
        const rawToken = req.headers['asaas-access-token'];
        const webhookToken = Array.isArray(rawToken) ? rawToken[0] : rawToken;
        const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN;

        // 1. Verificação de Token/Segurança
        if (configuredToken && webhookToken !== configuredToken) {
            console.warn('[Webhook Asaas] Token de acesso inválido no webhook');
            return res.status(401).json({ error: 'Token de webhook inválido' });
        }

        const { event, payment } = req.body;
        console.log(`[Webhook Asaas] Evento recebido: ${event}`, payment?.id);

        if (!payment || !payment.id) {
            return res.status(200).json({ received: true });
        }

        // 2. Buscar transação e usuário vinculados
        let transaction = await prisma.paymentTransaction.findUnique({
            where: { asaasPaymentId: payment.id }
        });

        let user = null;
        if (transaction) {
            user = await prisma.user.findUnique({ where: { id: transaction.userId } });
        } else if (payment.customer) {
            user = await prisma.user.findUnique({ where: { asaasCustomerId: payment.customer } });
        }

        // 3. Idempotência: Se o evento é de confirmação e a transação já foi processada como RECEIVED/CONFIRMED, ignore o reprocessamento.
        if ((event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') && transaction?.status === 'RECEIVED') {
            console.log(`[Webhook Asaas] Pagamento ${payment.id} já processado anteriormente (Idempotente).`);
            return res.status(200).json({ received: true, idempotent: true });
        }

        // 4. Processamento dos Eventos
        if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
            const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : new Date();
            const isAnual = user?.billingCycle === 'anual';
            const nextDueDate = new Date(paymentDate);
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
                        paymentDate
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
                        description: payment.description || 'Cobrança confirmada via Asaas',
                        paymentDate
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
