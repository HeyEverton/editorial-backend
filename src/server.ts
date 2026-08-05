import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma.js';
import { register, login, verifyToken } from './controllers/auth.controller.js';
import { authenticateToken } from './middleware/auth.middleware.js';
import {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
    getDashboardStats
} from './controllers/project.controller.js';
import bcrypt from 'bcrypt';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
    origin: (origin, callback) => {
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

app.get('/health', (req, res) => {
    res.json({ status: 'OK', message: 'Servidor rodando' });
});

app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.get('/api/auth/verify', authenticateToken, verifyToken);

app.post('/api/projects', authenticateToken, createProject);
app.get('/api/projects', authenticateToken, getProjects);
app.get('/api/projects/dashboard', authenticateToken, getDashboardStats);
app.get('/api/projects/:id', authenticateToken, getProjectById);
app.put('/api/projects/:id', authenticateToken, updateProject);
app.delete('/api/projects/:id', authenticateToken, deleteProject);

app.get('/api/protected', authenticateToken, (req: any, res) => {
    res.json({
        message: 'Você acessou uma rota protegida!',
        user: req.user
    });
});

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err);
    res.status(500).json({
        error: 'Erro interno do servidor',
        message: err.message
    });
});

async function inicializarServidor() {
    try {
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
            console.log('[OK] Usuário padrão criado');
        }

        app.listen(PORT, () => {
            console.log(`[SERVIDO] Servidor rodando na porta ${PORT}`);
        });
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

inicializarServidor();
