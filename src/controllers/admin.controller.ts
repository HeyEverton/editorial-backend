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
   USERS & ROLES ASSIGNMENT CONTROLLER
════════════════════════════════════════════════════════════════════ */

export async function getAdminUsers(req: Request, res: Response) {
  try {
    const users = await prisma.user.findMany({
      include: {
        role: true,
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = users.map((u) => ({
      id: u.id,
      name: u.name || 'Sem nome',
      email: u.email,
      role: u.role ? u.role.name : 'User',
      roleId: u.roleId,
      plan: u.plan ? u.plan.name : 'Gratuito',
      planId: u.planId,
      createdAt: u.createdAt,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('[Admin getAdminUsers Error]', error);
    res.status(500).json({ error: 'Erro interno ao buscar usuários.' });
  }
}

export async function updateUserRoleAndPlan(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { roleId, planId } = req.body;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        roleId: roleId !== undefined ? roleId : user.roleId,
        planId: planId !== undefined ? planId : user.planId,
      },
      include: {
        role: true,
        plan: true,
      },
    });

    res.json({ message: 'Cargo e plano do usuário atualizados com sucesso.', user: updated });
  } catch (error) {
    console.error('[Admin updateUserRoleAndPlan Error]', error);
    res.status(500).json({ error: 'Erro interno ao atualizar usuário.' });
  }
}
