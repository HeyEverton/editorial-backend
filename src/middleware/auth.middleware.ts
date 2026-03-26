import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Estendendo o Request do Express para aceitar o usuário
export interface AuthRequest extends Request {
  user?: any;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
    // Obter token do header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            error: 'Token não fornecido',
            message: 'Acesso negado. Por favor, faça login.'
        });
    }

    try {
        // Verificar e decodificar token
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Anexar dados do usuário à requisição
        next();
    } catch (error: any) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado',
                message: 'Sua sessão expirou. Por favor, faça login novamente.'
            });
        }

        return res.status(403).json({
            error: 'Token inválido',
            message: 'Token de autenticação inválido.'
        });
    }
}

export default authenticateToken;
