import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import dotenv from 'dotenv';
import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware.js';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const SALT_ROUNDS = 10;

// Registrar novo usuário
export async function register(req: Request, res: Response) {
    try {
        const { email, senha, nome } = req.body;

        // Validação
        if (!email || !senha) {
            return res.status(400).json({
                error: 'Dados inválidos',
                message: 'Email e senha são obrigatórios.'
            });
        }

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                error: 'Email inválido',
                message: 'Por favor, forneça um email válido.'
            });
        }

        // Verificar se usuário já existe
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(409).json({
                error: 'Usuário já existe',
                message: 'Este email já está cadastrado.'
            });
        }

        // Hash da senha
        const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

        // Criar usuário (Tokens já serão 40 por default do banco de dados)
        const user = await prisma.user.create({
            data: {
                email,
                passwordHash: senhaHash,
                name: nome
            }
        });

        // Gerar token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Usuário criado com sucesso',
            token,
            user: {
                id: user.id,
                email: user.email,
                nome: user.name
            }
        });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao criar usuário. Tente novamente.'
        });
    }
}

// Login
export async function login(req: Request, res: Response) {
    try {
        const { email, senha } = req.body;

        // Validação
        if (!email || !senha) {
            return res.status(400).json({
                error: 'Dados inválidos',
                message: 'Email e senha são obrigatórios.'
            });
        }

        // Buscar usuário
        const user = await prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            return res.status(401).json({
                error: 'Credenciais inválidas',
                message: 'Email ou senha incorretos.'
            });
        }

        // Verificar senha
        const senhaValida = await bcrypt.compare(senha, user.passwordHash);
        if (!senhaValida) {
            return res.status(401).json({
                error: 'Credenciais inválidas',
                message: 'Email ou senha incorretos.'
            });
        }

        // Gerar token JWT
        const token = jwt.sign(
            { id: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            message: 'Login realizado com sucesso',
            token,
            user: {
                id: user.id,
                email: user.email,
                nome: user.name
            }
        });
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao processar login. Tente novamente.'
        });
    }
}

// Verificar token e retornar dados do usuário
export async function verifyToken(req: AuthRequest, res: Response) {
    try {
        // req.user já foi preenchido pelo middleware authenticateToken
        const user = await prisma.user.findUnique({
             where: { id: req.user.id }
        });

        if (!user) {
            return res.status(404).json({
                error: 'Usuário não encontrado',
                message: 'Usuário não existe mais no sistema.'
            });
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                nome: user.name
            }
        });
    } catch (error) {
        console.error('Erro ao verificar token:', error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao verificar autenticação.'
        });
    }
}
