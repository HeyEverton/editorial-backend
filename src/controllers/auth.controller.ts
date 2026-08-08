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
    const user = await prisma.user.findUnique({
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
    });

    if (!user) return null;

    const permissions = user.role?.rolePermissions.map(rp => ({
        subject: rp.permission.subject,
        actions: rp.actions
    })) || [];

    return {
        id: user.id,
        email: user.email,
        nome: user.name,
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
        generationsThisMonth: user.generationsThisMonth
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
