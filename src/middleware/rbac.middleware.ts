import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AuthRequest } from './auth.middleware.js';
import { defineAbilityForUser, AppAbility } from '../lib/ability.js';

export interface RbacRequest extends AuthRequest {
  userFull?: any;
  ability?: AppAbility;
}

export function checkPermission(action: string, subject: string) {
  return async (req: RbacRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error: 'Não autenticado',
          message: 'Usuário não autenticado.',
        });
      }

      // Buscar usuário com cargo, permissões e plano
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
          plan: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          error: 'Usuário não encontrado',
          message: 'Conta de usuário não encontrada.',
        });
      }

      const ability = defineAbilityForUser(user);
      req.userFull = user;
      req.ability = ability;

      if (ability.cannot(action, subject)) {
        return res.status(403).json({
          error: 'Acesso Negado',
          message: `Você não tem permissão para realizar a ação '${action}' no recurso '${subject}'.`,
        });
      }

      next();
    } catch (error) {
      console.error('[RBAC Error]', error);
      res.status(500).json({
        error: 'Erro de Autorização',
        message: 'Erro interno ao validar permissões de acesso.',
      });
    }
  };
}

export function checkPlanLimits(action: 'generate_ai' | 'create_project') {
  return async (req: RbacRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.userFull || (await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { plan: true },
      }));

      if (!user || !user.plan) {
        // Se não houver plano explícito, carrega o plano 'essencial' por padrão
        const defaultPlan = await prisma.plan.findUnique({ where: { slug: 'essencial' } });
        if (!defaultPlan) return next();
        user.plan = defaultPlan;
      }

      const plan = user.plan;

      if (action === 'generate_ai') {
        if (plan.maxGenerationsPerMonth !== -1 && user.generationsThisMonth >= plan.maxGenerationsPerMonth) {
          return res.status(403).json({
            error: 'Limite do Plano Atingido',
            message: `Você atingiu o limite mensal de ${plan.maxGenerationsPerMonth} gerações do seu Plano ${plan.name}. Faça o upgrade para o Plano Elite para ter gerações ilimitadas.`,
          });
        }
      }

      if (action === 'create_project') {
        const activeProjectsCount = await prisma.project.count({
          where: { userId: user.id },
        });
        const accumulatedCreated = (user as any).projectsCreatedTotal || 0;
        const totalCountForLimit = Math.max(activeProjectsCount, accumulatedCreated);

        if (plan.maxProjects !== -1 && totalCountForLimit >= plan.maxProjects) {
          return res.status(403).json({
            error: 'Limite de Projetos Atingido',
            message: `Você atingiu o limite de ${plan.maxProjects} projetos do seu Plano ${plan.name}. A exclusão de projetos antigos não restaura seu limite de criação. Faça upgrade de plano para criar novos projetos.`,
          });
        }
      }

      next();
    } catch (error) {
      console.error('[Plan Limit Error]', error);
      res.status(500).json({
        error: 'Erro de Limite de Plano',
        message: 'Erro interno ao checar limites do plano.',
      });
    }
  };
}
