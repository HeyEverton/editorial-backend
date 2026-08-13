import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { generateUlid } from '../lib/ulid.js';
import dotenv from 'dotenv';
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const SALT_ROUNDS = 10;

async function getUserPayload(userId: string) {
    const [user, totalProjects] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            include: {
                role: {
                    include: {
                        rolePermissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                },
                plan: true
            }
        }),
        prisma.project.count({
            where: { userId }
        })
    ]);

    if (!user) return null;

    const permissions = user.role?.rolePermissions.map(rp => ({
        subject: rp.permission.subject,
        actions: rp.actions
    })) || [];

    return {
        id: user.id,
        email: user.email,
        nome: user.name,
        phone: user.phone || '',
        cpf: user.cpf || '',
        tokens: user.tokens,
        role: user.role ? user.role.name : 'User',
        roleId: user.roleId,
        isSystemAdmin: user.role?.name === 'Admin System',
        permissions,
        plan: user.plan ? {
            id: user.plan.id,
            name: user.plan.name,
            slug: user.plan.slug,
            maxGenerationsPerMonth: user.plan.maxGenerationsPerMonth,
            maxProjects: user.plan.maxProjects,
            hasA3Export: user.plan.hasA3Export,
            hasWhiteLabel: user.plan.hasWhiteLabel
        } : null,
        billingCycle: user.billingCycle,
        generationsThisMonth: user.generationsThisMonth,
        totalProjects
    };
}

export async function register(req: Request, res: Response) {
    try {
        const { email, senha, nome } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                error: 'Dados inválidos',
                message: 'Email e senha são obrigatórios.'
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Email inválido',
                message: 'Por favor, forneça um email válido.'
            });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(409).json({
                error: 'Usuário já existe',
                message: 'Este email já está cadastrado.'
            });
        }

        // Buscar cargo "User" e plano "essencial" padrão
        const defaultRole = await prisma.role.findUnique({ where: { name: 'User' } });
        const defaultPlan = await prisma.plan.findUnique({ where: { slug: 'essencial' } });

        const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);
        const newUserId = generateUlid();

        const user = await prisma.user.create({
            data: {
                id: newUserId,
                email,
                passwordHash: senhaHash,
                name: nome,
                roleId: defaultRole?.id,
                planId: defaultPlan?.id,
                billingCycle: 'mensal'
            }
        });

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const userPayload = await getUserPayload(user.id);

        res.status(201).json({
            message: 'Usuário criado com sucesso',
            token,
            user: userPayload
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao criar usuário. Tente novamente.'
        });
    }
}

export async function login(req: Request, res: Response) {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({
                error: 'Dados inválidos',
                message: 'Email e senha são obrigatórios.'
            });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            return res.status(401).json({
                error: 'Credenciais inválidas',
                message: 'Email ou senha incorretos.'
            });
        }

        const senhaValida = await bcrypt.compare(senha, user.passwordHash);
        if (!senhaValida) {
            return res.status(401).json({
                error: 'Credenciais inválidas',
                message: 'Email ou senha incorretos.'
            });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        const userPayload = await getUserPayload(user.id);

        res.json({
            message: 'Login realizado com sucesso',
            token,
            user: userPayload
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao processar login. Tente novamente.'
        });
    }
}

export async function verifyToken(req: AuthRequest, res: Response) {
    try {
        const userPayload = await getUserPayload(req.user.id);

        if (!userPayload) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                message: 'Usuário não existe mais no sistema.'
            });
        }

        res.json({
            user: userPayload
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao verificar autenticação.'
        });
    }
}

export async function updateProfile(req: AuthRequest, res: Response) {
    try {
        const userId = req.user.id;
        const { nome, email, phone, cpf, senha } = req.body;

        const updateData: any = {};

        if (nome !== undefined) updateData.name = nome;
        if (phone !== undefined) updateData.phone = phone;
        if (cpf !== undefined) updateData.cpf = cpf;

        if (email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({
                    error: 'Email inválido',
                    message: 'Por favor, forneça um email válido.'
                });
            }

            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser && existingUser.id !== userId) {
                return res.status(409).json({
                    error: 'Email em uso',
                    message: 'Este email já está sendo utilizado por outra conta.'
                });
            }
            updateData.email = email;
        }

        if (senha) {
            if (senha.length < 6) {
                return res.status(400).json({
                    error: 'Senha muito curta',
                    message: 'A senha deve ter pelo menos 6 caracteres.'
                });
            }
            updateData.passwordHash = await bcrypt.hash(senha, SALT_ROUNDS);
        }

        await prisma.user.update({
            where: { id: userId },
            data: updateData
        });

        const updatedPayload = await getUserPayload(userId);

        res.json({
            message: 'Perfil atualizado com sucesso',
            user: updatedPayload
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao atualizar perfil.'
        });
    }
}

export async function getUserAnalytics(req: AuthRequest, res: Response) {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado.' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { plan: true, projects: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        const totalProjects = user.projects.length;
        const maxGenerations = user.plan?.maxGenerationsPerMonth || 50;
        const tokensLeft = user.tokens;
        const generationsThisMonth = user.generationsThisMonth;

        const createdDate = new Date(user.createdAt);
        const diffDays = Math.max(1, Math.ceil((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)));
        const weeksActive = Math.max(1, Math.ceil(diffDays / 7));
        const weeklyAverage = Number((totalProjects / weeksActive).toFixed(1));

        let reelsCount = 0;
        let carrosselCount = 0;
        let postEstaticoCount = 0;
        let storiesCount = 0;

        user.projects.forEach(p => {
            const content = p.content as any;
            if (content && Array.isArray(content.sessions)) {
                content.sessions.forEach((s: any) => {
                    const fmt = String(s.format || '').toUpperCase();
                    if (fmt.includes('REELS')) reelsCount++;
                    else if (fmt.includes('CARROSSEL')) carrosselCount++;
                    else if (fmt.includes('STORIES')) storiesCount++;
                    else postEstaticoCount++;
                });
            } else {
                reelsCount++;
            }
        });

        const totalFormats = reelsCount + carrosselCount + postEstaticoCount + storiesCount || 1;

        const formatDistribution = [
            { name: 'Reels', count: reelsCount, percentage: Math.round((reelsCount / totalFormats) * 100) },
            { name: 'Carrossel', count: carrosselCount, percentage: Math.round((carrosselCount / totalFormats) * 100) },
            { name: 'Post Estático', count: postEstaticoCount, percentage: Math.round((postEstaticoCount / totalFormats) * 100) },
            { name: 'Stories', count: storiesCount, percentage: Math.round((storiesCount / totalFormats) * 100) }
        ];

        const period = (req.query.period as string) || '30d';
        const periodDays = period === '7d' ? 7 : period === '90d' ? 90 : period === '1a' ? 365 : 30;

        const timeSeries = [];
        for (let i = periodDays - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            
            // Contagem de gerações/projetos do próprio usuário naquele dia
            const dayGenCount = user.projects.filter(p => {
                const pDate = new Date(p.createdAt);
                return pDate.toDateString() === d.toDateString();
            }).length;

            timeSeries.push({
                date: dateStr,
                generations: dayGenCount
            });
        }

        const recentProjects = user.projects
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, 6)
            .map(p => ({
                id: p.id,
                name: p.name,
                updatedAt: p.updatedAt,
                shortDescription: p.shortDescription || 'Manuscrito Estratégico'
            }));

        res.json({
            user: {
                name: user.name,
                email: user.email,
                planName: user.plan?.name || 'Essencial',
                tokensLeft,
                generationsThisMonth,
                maxGenerations,
                totalProjects,
                weeklyAverage
            },
            formatDistribution,
            timeSeries,
            recentProjects
        });
    } catch (error) {
        console.error('[getUserAnalytics Error]', error);
        res.status(500).json({ error: 'Erro ao carregar analytics pessoal.' });
    }
}
