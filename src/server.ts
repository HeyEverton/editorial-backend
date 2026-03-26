import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma.js';
import { register, login, verifyToken } from './controllers/auth.controller.js';
import { authenticateToken } from './middleware/auth.middleware.js';
import bcrypt from 'bcrypt';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Lista de origens permitidas
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL, // URL frontend configurada via env
].filter(Boolean); // Remove undefined

// Middlewares
app.use(cors({
    origin: (origin, callback) => {
        // Permitir requests sem origin (mobile apps, Postman, etc)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());

// Rota de health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Servidor rodando' });
});

// Rotas de autenticação
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.get('/api/auth/verify', authenticateToken, verifyToken);

// Rota protegida de exemplo
app.get('/api/protected', authenticateToken, (req: any, res) => {
    res.json({
        message: 'Você acessou uma rota protegida!',
        user: req.user
    });
});

// Handler de erros
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: err.message
    });
});

// Inicializar banco de dados via Prisma e criar usuário padrão
async function inicializarServidor() {
    try {
        // Criar usuário padrão se não existir
        const emailPadrao = 'editor@elite.com';
        const userExistente = await prisma.user.findUnique({
            where: { email: emailPadrao }
        });

        if (!userExistente) {
            const senhaPadrao = 'senha123';
            const senhaHash = await bcrypt.hash(senhaPadrao, 10);
            
            await prisma.user.create({
                data: {
                    email: emailPadrao,
                    passwordHash: senhaHash,
                    name: 'Editor Elite'
                }
            });
            console.log('✅ Usuário padrão criado:');
            console.log('   Email:', emailPadrao);
            console.log('   Senha:', senhaPadrao);
        } else {
            console.log('ℹ️  Usuário padrão já existe:', emailPadrao);
        }

        app.listen(PORT, () => {
            console.log(`\n🚀 Servidor rodando na porta ${PORT}`);
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`\n📋 Rotas disponíveis:`);
            console.log(`   POST /api/auth/register - Registrar novo usuário`);
            console.log(`   POST /api/auth/login - Fazer login`);
            console.log(`   GET  /api/auth/verify - Verificar token`);
            console.log(`   GET  /api/protected - Rota protegida (exemplo)\n`);
        });
    } catch (error) {
        console.error('❌ Erro ao inicializar servidor:', error);
        process.exit(1);
    }
}

inicializarServidor();
