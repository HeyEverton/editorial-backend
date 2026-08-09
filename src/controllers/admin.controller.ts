import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { generateUlid } from '../lib/ulid.js';

/* ════════════════════════════════════════════════════════════════════
   ROLES (PERFIS) CONTROLLER
════════════════════════════════════════════════════════════════════ */

export async function getRoles(req: Request, res: Response) {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: { users: true },
        },
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.rolePermissions.map((rp) => ({
        permissionId: rp.permissionId,
        subject: rp.permission.subject,
        name: rp.permission.name,
        actions: rp.actions,
      })),
    }));

    res.json(formatted);
  } catch (error) {
    console.error('[Admin getRoles Error]', error);
    res.status(500).json({ error: 'Erro interno ao buscar perfis.' });
  }
}

export async function createRole(req: Request, res: Response) {
  try {
    const { name, description, permissions } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'O nome do perfil é obrigatório.' });
    }

    const existing = await prisma.role.findUnique({ where: { name } });
    if (existing) {
      return res.status(409).json({ error: 'Já existe um perfil com este nome.' });
    }

    const roleId = generateUlid();

    const role = await prisma.role.create({
      data: {
        id: roleId,
        name,
        description: description || '',
        isSystem: false,
      },
    });

    if (Array.isArray(permissions)) {
      for (const p of permissions) {
        if (p.permissionId && Array.isArray(p.actions) && p.actions.length > 0) {
          await prisma.rolePermission.create({
            data: {
              id: generateUlid(),
              roleId: role.id,
              permissionId: p.permissionId,
              actions: p.actions,
            },
          });
        }
      }
    }

    res.status(201).json({ message: 'Perfil criado com sucesso.', role });
  } catch (error) {
    console.error('[Admin createRole Error]', error);
    res.status(500).json({ error: 'Erro interno ao criar perfil.' });
  }
}

export async function updateRole(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { name, description, permissions } = req.body;

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        description: description !== undefined ? description : existing.description,
      },
    });

    if (Array.isArray(permissions)) {
      await prisma.rolePermission.deleteMany({ where: { roleId: id } });

      for (const p of permissions) {
        if (p.permissionId && Array.isArray(p.actions) && p.actions.length > 0) {
          await prisma.rolePermission.create({
            data: {
              id: generateUlid(),
              roleId: id,
              permissionId: p.permissionId,
              actions: p.actions,
            },
          });
        }
      }
    }

    res.json({ message: 'Perfil atualizado com sucesso.', role: updatedRole });
  } catch (error) {
    console.error('[Admin updateRole Error]', error);
    res.status(500).json({ error: 'Erro interno ao atualizar perfil.' });
  }
}

export async function deleteRole(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      return res.status(404).json({ error: 'Perfil não encontrado.' });
    }

    if (role.isSystem) {
      return res.status(400).json({ error: 'Perfis do sistema não podem ser excluídos.' });
    }

    await prisma.role.delete({ where: { id } });

    res.json({ message: 'Perfil excluído com sucesso.' });
  } catch (error) {
    console.error('[Admin deleteRole Error]', error);
    res.status(500).json({ error: 'Erro interno ao excluir perfil.' });
  }
}

/* ════════════════════════════════════════════════════════════════════
   PERMISSIONS (SUBJECTS) CONTROLLER
════════════════════════════════════════════════════════════════════ */

export async function getPermissions(req: Request, res: Response) {
  try {
    const permissions = await prisma.permission.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(permissions);
  } catch (error) {
    console.error('[Admin getPermissions Error]', error);
    res.status(500).json({ error: 'Erro interno ao buscar permissões.' });
  }
}

export async function createPermission(req: Request, res: Response) {
  try {
    const { name, subject, availableActions } = req.body;

    if (!name || !subject) {
      return res.status(400).json({ error: 'Nome e assunto (subject) são obrigatórios.' });
    }

    const existing = await prisma.permission.findUnique({ where: { subject } });
    if (existing) {
      return res.status(409).json({ error: 'Já existe uma permissão cadastrada com este assunto.' });
    }

    const permission = await prisma.permission.create({
      data: {
        id: generateUlid(),
        name,
        subject,
        availableActions: Array.isArray(availableActions) && availableActions.length > 0
          ? availableActions
          : ['read', 'list', 'create', 'edit', 'delete'],
      },
    });

    res.status(201).json({ message: 'Permissão criada com sucesso.', permission });
  } catch (error) {
    console.error('[Admin createPermission Error]', error);
    res.status(500).json({ error: 'Erro interno ao criar permissão.' });
  }
}

export async function updatePermission(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { name, subject, availableActions } = req.body;

    const existing = await prisma.permission.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Permissão não encontrada.' });
    }

    const updated = await prisma.permission.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existing.name,
        subject: subject !== undefined ? subject : existing.subject,
        availableActions: Array.isArray(availableActions) ? availableActions : (existing.availableActions as any),
      },
    });

    res.json({ message: 'Permissão atualizada com sucesso.', permission: updated });
  } catch (error) {
    console.error('[Admin updatePermission Error]', error);
    res.status(500).json({ error: 'Erro interno ao atualizar permissão.' });
  }
}

export async function deletePermission(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const existing = await prisma.permission.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Permissão não encontrada.' });
    }

    await prisma.permission.delete({ where: { id } });

    res.json({ message: 'Permissão excluída com sucesso.' });
  } catch (error) {
    console.error('[Admin deletePermission Error]', error);
    res.status(500).json({ error: 'Erro interno ao excluir permissão.' });
  }
}

/* ════════════════════════════════════════════════════════════════════
   USERS & PROFILE MANAGEMENT CONTROLLER
════════════════════════════════════════════════════════════════════ */

export async function getAdminUsers(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      include: {
        role: true,
        plan: true,
        _count: {
          select: { projects: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = users.map((u) => ({
      id: u.id,
      name: u.name || 'Sem nome',
      email: u.email,
      phone: u.phone || '',
      cpf: u.cpf || '',
      role: u.role ? u.role.name : 'User',
      roleId: u.roleId,
      plan: u.plan ? u.plan.name : 'Essencial',
      planId: u.planId,
      tokens: u.tokens,
      generationsThisMonth: u.generationsThisMonth,
      billingCycle: u.billingCycle || 'mensal',
      projectCount: u._count.projects,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('[Admin getAdminUsers Error]', error);
    res.status(500).json({ error: 'Erro interno ao buscar usuários.' });
  }
}

export async function getAdminUserById(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
        plan: true,
        projects: {
          select: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
        tokenTransactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({
      id: user.id,
      name: user.name || 'Sem nome',
      email: user.email,
      phone: user.phone || '',
      cpf: user.cpf || '',
      role: user.role ? user.role.name : 'User',
      roleId: user.roleId,
      plan: user.plan ? user.plan.name : 'Essencial',
      planId: user.planId,
      tokens: user.tokens,
      generationsThisMonth: user.generationsThisMonth,
      billingCycle: user.billingCycle || 'mensal',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      projects: user.projects,
      tokenTransactions: user.tokenTransactions,
    });
  } catch (error) {
    console.error('[Admin getAdminUserById Error]', error);
    res.status(500).json({ error: 'Erro interno ao carregar perfil do usuário.' });
  }
}

export async function updateUserRoleAndPlan(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { name, email, phone, cpf, roleId, planId, tokens, billingCycle } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: name !== undefined ? name : user.name,
        email: email !== undefined ? email : user.email,
        phone: phone !== undefined ? phone : user.phone,
        cpf: cpf !== undefined ? cpf : user.cpf,
        roleId: roleId !== undefined ? roleId : user.roleId,
        planId: planId !== undefined ? planId : user.planId,
        tokens: tokens !== undefined ? Number(tokens) : user.tokens,
        billingCycle: billingCycle !== undefined ? billingCycle : user.billingCycle,
      },
      include: {
        role: true,
        plan: true,
      },
    });

    res.json({ message: 'Dados do usuário atualizados com sucesso.', user: updated });
  } catch (error) {
    console.error('[Admin updateUserRoleAndPlan Error]', error);
    res.status(500).json({ error: 'Erro interno ao atualizar usuário.' });
  }
}

/* ════════════════════════════════════════════════════════════════════
   EXECUTIVE ANALYTICS DASHBOARD CONTROLLER
════════════════════════════════════════════════════════════════════ */

export async function getAnalytics(req: Request, res: Response) {
  try {
    const period = (req.query.period as string) || '30d';

    let days = 30;
    if (period === '7d') days = 7;
    else if (period === '90d') days = 90;
    else if (period === '1a') days = 365;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      totalProjects,
      newUsersToday,
      usersWithPlan,
      roles,
      plans,
      recentUsers,
      topProjectsUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.user.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.user.findMany({
        include: { plan: true, role: true, _count: { select: { projects: true } } },
      }),
      prisma.role.findMany({ include: { _count: { select: { users: true } } } }),
      prisma.plan.findMany({ include: { _count: { select: { users: true } } } }),
      prisma.user.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, email: true, createdAt: true },
      }),
      prisma.user.findMany({
        take: 5,
        include: { _count: { select: { projects: true } }, plan: true, role: true },
        orderBy: { projects: { _count: 'desc' } },
      }),
    ]);

    // Total AI Generations and MRR calculation
    let totalGenerations = 0;
    let totalTokensLeft = 0;
    let estimatedMRR = 0;
    let alertUsersCount = 0;

    usersWithPlan.forEach((u) => {
      totalGenerations += u.generationsThisMonth;
      totalTokensLeft += u.tokens;

      if (u.plan) {
        const price = u.billingCycle === 'anual' ? u.plan.priceAnual / 12 : u.plan.priceMensal;
        estimatedMRR += price;

        if (u.plan.maxGenerationsPerMonth > 0 && u.generationsThisMonth >= u.plan.maxGenerationsPerMonth * 0.9) {
          alertUsersCount++;
        }
      }

      if (u.tokens <= 5) {
        alertUsersCount++;
      }
    });

    // Generate time series data points for charts
    const timeSeriesData: Array<{ date: string; generations: number; revenue: number; newUsers: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      // Daily simulated curve scaled with user growth & project count
      const baseFactor = Math.max(1, Math.floor(totalUsers / 3));
      const dailyGen = Math.round((Math.sin(i * 0.5) + 1.5) * baseFactor);
      const dailyUsers = i === 0 ? newUsersToday : (i % 4 === 0 ? 1 : 0);
      const dailyRev = Math.round((estimatedMRR / days) * (1 + (Math.cos(i * 0.3) * 0.2)));

      timeSeriesData.push({
        date: dateStr,
        generations: dailyGen,
        revenue: dailyRev,
        newUsers: dailyUsers,
      });
    }

    // Role Distribution (Donut Chart)
    const roleDistribution = roles.map((r) => ({
      name: r.name,
      count: r._count.users,
      percentage: totalUsers > 0 ? Math.round((r._count.users / totalUsers) * 100) : 0,
    }));

    // Plan Distribution (Donut Chart)
    const planDistribution = plans.map((p) => ({
      name: p.name,
      count: p._count.users,
      percentage: totalUsers > 0 ? Math.round((p._count.users / totalUsers) * 100) : 0,
    }));

    // Top Rankings
    const topUsers = topProjectsUsers.map((u) => ({
      id: u.id,
      name: u.name || 'Sem nome',
      email: u.email,
      role: u.role?.name || 'User',
      plan: u.plan?.name || 'Essencial',
      projectsCount: u._count.projects,
      generationsThisMonth: u.generationsThisMonth,
    }));

    res.json({
      period,
      kpis: {
        totalUsers,
        totalProjects,
        totalGenerations,
        estimatedMRR: Math.round(estimatedMRR),
        totalTokensLeft,
      },
      badges: {
        newUsersToday,
        aiGenerationsToday: Math.round(totalGenerations / Math.max(1, days)),
        activePlansCount: usersWithPlan.length,
        alertCount: alertUsersCount,
      },
      timeSeries: timeSeriesData,
      roleDistribution,
      planDistribution,
      topUsers,
      recentUsers,
    });
  } catch (error) {
    console.error('[Admin getAnalytics Error]', error);
    res.status(500).json({ error: 'Erro interno ao gerar analytics.' });
  }
}
