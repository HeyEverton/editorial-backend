import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { generateUlid } from '../lib/ulid.js';
import { AuthRequest } from '../middleware/auth.middleware.js';

export async function createProject(req: AuthRequest, res: Response) {
    try {
        const { name, shortDescription, content } = req.body;

        if (!name) {
            return res.status(400).json({
                error: 'Dados inválidos',
                message: 'O nome do projeto é obrigatório.'
            });
        }

        const project = await prisma.project.create({
            data: {
                id: generateUlid(),
                name,
                shortDescription: shortDescription || '',
                content: content || {},
                userId: req.user.id
            }
        });

        res.status(201).json(project);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao criar projeto.'
        });
    }
}

export async function getProjects(req: AuthRequest, res: Response) {
    try {
        const projects = await prisma.project.findMany({
            where: { userId: req.user.id },
            orderBy: { updatedAt: 'desc' }
        });

        res.json(projects);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao buscar projetos.'
        });
    }
}

export async function getProjectById(req: AuthRequest, res: Response) {
    try {
        const { id } = req.params;

        const project = await prisma.project.findFirst({
            where: {
                id: String(id),
                userId: req.user.id
            }
        });

        if (!project) {
            return res.status(404).json({
                error: 'Não encontrado',
                message: 'Projeto não encontrado ou acesso negado.'
            });
        }

        res.json(project);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao buscar detalhes do projeto.'
        });
    }
}

export async function updateProject(req: AuthRequest, res: Response) {
    try {
        const { id } = req.params;
        const { name, shortDescription, content } = req.body;

        const existingProject = await prisma.project.findFirst({
            where: {
                id: String(id),
                userId: req.user.id
            }
        });

        if (!existingProject) {
            return res.status(404).json({
                error: 'Não encontrado',
                message: 'Projeto não encontrado ou acesso negado.'
            });
        }

        const updatedProject = await prisma.project.update({
            where: { id: String(id) },
            data: {
                name: name !== undefined ? name : existingProject.name,
                shortDescription: shortDescription !== undefined ? shortDescription : existingProject.shortDescription,
                content: content !== undefined ? content : existingProject.content
            }
        });

        res.json(updatedProject);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao atualizar projeto.'
        });
    }
}

export async function deleteProject(req: AuthRequest, res: Response) {
    try {
        const { id } = req.params;

        const existingProject = await prisma.project.findFirst({
            where: {
                id: String(id),
                userId: req.user.id
            }
        });

        if (!existingProject) {
            return res.status(404).json({
                error: 'Não encontrado',
                message: 'Projeto não encontrado ou acesso negado.'
            });
        }

        await prisma.project.delete({
            where: { id: String(id) }
        });

        res.json({ message: 'Projeto excluído com sucesso.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao excluir projeto.'
        });
    }
}

export async function getDashboardStats(req: AuthRequest, res: Response) {
    try {
        const userId = req.user.id;

        const totalProjects = await prisma.project.count({
            where: { userId }
        });

        const lastUpdatedProject = await prisma.project.findFirst({
            where: { userId },
            orderBy: { updatedAt: 'desc' }
        });

        res.json({
            totalProjects,
            lastUpdatedProject
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: 'Erro interno',
            message: 'Erro ao buscar estatísticas do dashboard.'
        });
    }
}
