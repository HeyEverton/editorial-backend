import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateUlid } from '../src/lib/ulid.js';

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Iniciando população inicial do banco de dados com ULID e RBAC...');

  // 1. Criar/Atualizar os 3 Planos Oficiais
  const plansData = [
    {
      id: generateUlid(),
      slug: 'essencial',
      name: 'Essencial',
      sub: 'O Ponto de Entrada',
      audience: 'Para criadores solo e iniciantes no estrategismo.',
      cta: 'Começar Agora',
      priceMensal: 67,
      priceAnual: 670,
      maxGenerationsPerMonth: 10,
      maxProjects: 5,
      hasA3Export: true,
      hasWhiteLabel: false,
      asaasPlanId: 'plan_asaas_essencial_mock',
      items: [
        '10 Arquiteturas Editoriais por mês',
        'Formulário Estratégico Guiado',
        'Exportação em PDF Padrão',
        'Acesso a 3 Presets Básicos',
        'Suporte via E-mail',
      ],
    },
    {
      id: generateUlid(),
      slug: 'elite',
      name: 'Elite',
      sub: 'O Padrão de Agência',
      audience: 'Para estrategistas, social medias e agências boutique.',
      cta: 'Tornar-me Elite',
      priceMensal: 197,
      priceAnual: 1970,
      maxGenerationsPerMonth: -1,
      maxProjects: 10,
      hasA3Export: true,
      hasWhiteLabel: false,
      asaasPlanId: 'plan_asaas_elite_mock',
      items: [
        'Gerações Ilimitadas (I.A Gemini)',
        'Exportação PDF A3 Estratégico',
        '12+ Presets de Luxo (Classic Gold, Dark Onyx…)',
        "Branding: Marca d'água + Assinatura Tripla",
        'Histórico de até 10 Projetos Ativos',
        'Suporte Prioritário',
      ],
    },
    {
      id: generateUlid(),
      slug: 'master',
      name: 'Master Black',
      sub: 'Alta Consultoria',
      audience: 'Para consultores premium, grandes agências e educadores.',
      cta: 'Entrar para o Master Black',
      priceMensal: 297,
      priceAnual: 2490,
      maxGenerationsPerMonth: -1,
      maxProjects: -1,
      hasA3Export: true,
      hasWhiteLabel: true,
      asaasPlanId: 'plan_asaas_master_mock',
      items: [
        'Tudo do Plano Elite',
        'Modo White-Label (sem marca Studio OS)',
        'Suporte VIP via WhatsApp',
        'Presets Exclusivos e Customizados',
        'Mentoria Trimestral em Grupo',
      ],
    },
  ];

  const dbPlans: Record<string, any> = {};
  for (const p of plansData) {
    const existing = await prisma.plan.findUnique({ where: { slug: p.slug } });
    if (!existing) {
      dbPlans[p.slug] = await prisma.plan.create({ data: p });
    } else {
      dbPlans[p.slug] = existing;
    }
  }
  console.log('[SEED] Planos sincronizados.');

  // 2. Criar Assuntos / Permissões Padrão (Subjects & Available Actions)
  const permissionsData = [
    { name: 'Página de Autenticação', subject: 'auth', availableActions: ['read'] },
    { name: 'Gerenciamento Total', subject: 'manage', availableActions: ['manage'] },
    { name: 'Usuários do Sistema', subject: 'users', availableActions: ['read', 'list', 'create', 'edit', 'delete'] },
    { name: 'Perfil Pessoal', subject: 'profile', availableActions: ['read', 'edit'] },
    { name: 'Cargos e Funções', subject: 'roles', availableActions: ['read', 'list', 'create', 'edit', 'delete'] },
    { name: 'Permissões do Sistema', subject: 'permission', availableActions: ['read', 'list', 'create', 'edit', 'delete'] },
    { name: 'Projetos Editoriais', subject: 'projects', availableActions: ['read', 'list', 'create', 'edit', 'delete'] },
    { name: 'Geração de IA', subject: 'ai', availableActions: ['read', 'create'] },
    { name: 'Analytics e Relatórios', subject: 'analytics', availableActions: ['read', 'list', 'export'] },
    { name: 'Empresa', subject: 'empresa', availableActions: ['read', 'create', 'delete', 'list', 'edit', 'block', 'manage'] },
  ];

  const dbPermissions: Record<string, any> = {};
  for (const perm of permissionsData) {
    const existing = await prisma.permission.findUnique({ where: { subject: perm.subject } });
    if (!existing) {
      dbPermissions[perm.subject] = await prisma.permission.create({
        data: {
          id: generateUlid(),
          ...perm,
        },
      });
    } else {
      dbPermissions[perm.subject] = existing;
    }
  }
  console.log('[SEED] Permissões (Subjects) sincronizados.');

  // 3. Criar Roles (Admin System, Administrator, User)
  const rolesData = [
    { name: 'Admin System', description: 'Super Administrador com acesso completo a tudo.', isSystem: true },
    { name: 'Administrator', description: 'Administrador da plataforma.', isSystem: true },
    { name: 'User', description: 'Usuário padrão do sistema.', isSystem: true },
  ];

  const dbRoles: Record<string, any> = {};
  for (const r of rolesData) {
    const existing = await prisma.role.findUnique({ where: { name: r.name } });
    if (!existing) {
      dbRoles[r.name] = await prisma.role.create({
        data: {
          id: generateUlid(),
          ...r,
        },
      });
    } else {
      dbRoles[r.name] = existing;
    }
  }
  console.log('[SEED] Perfis (Roles) sincronizados.');

  // 4. Vincular Permissões aos Perfis
  // Admin System tem todas as ações de todas as permissões
  for (const permKey of Object.keys(dbPermissions)) {
    const perm = dbPermissions[permKey];
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: dbRoles['Admin System'].id,
          permissionId: perm.id,
        },
      },
      update: { actions: perm.availableActions },
      create: {
        id: generateUlid(),
        roleId: dbRoles['Admin System'].id,
        permissionId: perm.id,
        actions: perm.availableActions,
      },
    });

    // Administrator também tem acesso amplo
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: dbRoles['Administrator'].id,
          permissionId: perm.id,
        },
      },
      update: { actions: perm.availableActions },
      create: {
        id: generateUlid(),
        roleId: dbRoles['Administrator'].id,
        permissionId: perm.id,
        actions: perm.availableActions,
      },
    });
  }

  // User tem permissão padrão para profile, projects, ai, auth
  const userSubjects = ['auth', 'profile', 'projects', 'ai'];
  for (const s of userSubjects) {
    if (dbPermissions[s]) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: dbRoles['User'].id,
            permissionId: dbPermissions[s].id,
          },
        },
        update: { actions: dbPermissions[s].availableActions },
        create: {
          id: generateUlid(),
          roleId: dbRoles['User'].id,
          permissionId: dbPermissions[s].id,
          actions: dbPermissions[s].availableActions,
        },
      });
    }
  }

  console.log('[SEED] Vínculos de permissões/perfis concluídos.');

  // 5. Usuário padrão Admin
  const emailPadrao = 'editor@elite.com';
  const userExistente = await prisma.user.findUnique({
    where: { email: emailPadrao },
  });

  if (!userExistente) {
    const senhaHash = await bcrypt.hash('senha123', 10);
    await prisma.user.create({
      data: {
        id: generateUlid(),
        email: emailPadrao,
        passwordHash: senhaHash,
        name: 'Editor Elite',
        roleId: dbRoles['Admin System'].id,
        planId: dbPlans['elite'].id,
        billingCycle: 'mensal',
        tokens: 100,
      },
    });
    console.log('[SEED] Usuário Admin padrão criado (editor@elite.com / senha123).');
  } else {
    // Garantir roleId e planId no usuário existente
    await prisma.user.update({
      where: { email: emailPadrao },
      data: {
        roleId: dbRoles['Admin System'].id,
        planId: dbPlans['elite'].id,
      },
    });
  }

  console.log('[SEED] População concluída com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
