import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma.js';
import { register, login, verifyToken } from './controllers/auth.controller.js';
import { authenticateToken } from './middleware/auth.middleware.js';
import { checkPermission, checkPlanLimits } from './middleware/rbac.middleware.js';
import {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
    getDashboardStats
} from './controllers/project.controller.js';
import {
    getRoles,
    createRole,
    updateRole,
    deleteRole,
    getPermissions,
    createPermission,
    updatePermission,
    deletePermission,
    getAdminUsers,
    getAdminUserById,
    updateUserRoleAndPlan,
    getAnalytics
} from './controllers/admin.controller.js';
import { generateEditorialDocument } from './controllers/ai.controller.js';

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

/* ── AUTENTICAÇÃO ── */
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);
app.get('/api/auth/verify', authenticateToken, verifyToken);

/* ── IA E GERAÇÃO DE CONTEÚDO ── */
app.post('/api/ai/generate', authenticateToken, checkPermission('create', 'ai'), checkPlanLimits('generate_ai'), generateEditorialDocument);

/* ── PROJETOS ── */
app.post('/api/projects', authenticateToken, checkPermission('create', 'projects'), checkPlanLimits('create_project'), createProject);
app.get('/api/projects', authenticateToken, checkPermission('list', 'projects'), getProjects);
app.get('/api/projects/dashboard', authenticateToken, getDashboardStats);
app.get('/api/projects/:id', authenticateToken, checkPermission('read', 'projects'), getProjectById);
app.put('/api/projects/:id', authenticateToken, checkPermission('edit', 'projects'), updateProject);
app.delete('/api/projects/:id', authenticateToken, checkPermission('delete', 'projects'), deleteProject);

/* ── ADMIN: CARGOS, PERMISSÕES, USUÁRIOS E ANALYTICS (RBAC) ── */
app.get('/api/admin/roles', authenticateToken, checkPermission('list', 'roles'), getRoles);
app.post('/api/admin/roles', authenticateToken, checkPermission('create', 'roles'), createRole);
app.put('/api/admin/roles/:id', authenticateToken, checkPermission('edit', 'roles'), updateRole);
app.delete('/api/admin/roles/:id', authenticateToken, checkPermission('delete', 'roles'), deleteRole);

app.get('/api/admin/permissions', authenticateToken, checkPermission('list', 'permission'), getPermissions);
app.post('/api/admin/permissions', authenticateToken, checkPermission('create', 'permission'), createPermission);
app.put('/api/admin/permissions/:id', authenticateToken, checkPermission('edit', 'permission'), updatePermission);
app.delete('/api/admin/permissions/:id', authenticateToken, checkPermission('delete', 'permission'), deletePermission);

app.get('/api/admin/users', authenticateToken, checkPermission('list', 'users'), getAdminUsers);
app.get('/api/admin/users/:id', authenticateToken, checkPermission('read', 'users'), getAdminUserById);
app.put('/api/admin/users/:id', authenticateToken, checkPermission('edit', 'users'), updateUserRoleAndPlan);
app.put('/api/admin/users/:id/role-plan', authenticateToken, checkPermission('edit', 'users'), updateUserRoleAndPlan);

app.get('/api/admin/analytics', authenticateToken, checkPermission('read', 'analytics'), getAnalytics);

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

app.listen(PORT, () => {
    console.log(`[SERVIDO] Servidor rodando na porta ${PORT}`);
});
