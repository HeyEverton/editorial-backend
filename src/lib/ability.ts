import { MongoAbility, createMongoAbility, AbilityBuilder } from '@casl/ability';
import { User, Role, RolePermission, Permission, Plan } from '@prisma/client';

export type AppAbility = MongoAbility;

export type UserWithRoleAndPlan = User & {
  role?: (Role & {
    rolePermissions?: (RolePermission & {
      permission: Permission;
    })[];
  }) | null;
  plan?: Plan | null;
};

export function defineAbilityForUser(user: UserWithRoleAndPlan): AppAbility {
  const { can, build } = new AbilityBuilder(createMongoAbility);

  if (user && user.role && user.role.name === 'Admin System') {
    can('manage', 'all');
  } else {
    // Permissões base garantidas a qualquer usuário autenticado da plataforma
    can('read', 'auth');
    can('read', 'profile');
    can('edit', 'profile');
    can('create', 'projects');
    can('read', 'projects');
    can('list', 'projects');
    can('edit', 'projects');
    can('delete', 'projects');
    can('create', 'ai');
    can('read', 'ai');

    // Permissões adicionais dinâmicas configuradas no perfil (Role) do banco
    if (user && user.role && user.role.rolePermissions) {
      for (const rp of user.role.rolePermissions) {
        const subject = rp.permission.subject;
        const actions = (rp.actions as string[]) || [];

        for (const action of actions) {
          can(action, subject);
        }
      }
    }
  }

  return build();
}
