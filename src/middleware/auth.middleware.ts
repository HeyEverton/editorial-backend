import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { Request, Response, NextFunction } from 'express';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export interface AuthRequest extends Request {
  user?: any;
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'Token não fornecido',
            message: 'Acesso negado. Por favor, faça login.'
        });
    }

    try {
        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (!decoded || typeof decoded.id !== 'string') {
            return res.status(401).json({
                error: 'Sessão inválida',
                message: 'Por favor, faça login novamente para atualizar sua credencial.'
            });
        }
        req.user = decoded;
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
