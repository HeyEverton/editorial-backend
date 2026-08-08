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

  if (user && user.role) {
    if (user.role.name === 'Admin System') {
      can('manage', 'all');
    } else if (user.role.rolePermissions) {
      for (const rp of user.role.rolePermissions) {
        const subject = rp.permission.subject;
        const actions = (rp.actions as string[]) || [];

        for (const action of actions) {
          can(action, subject);
        }
      }
    }
  } else {
    can('read', 'auth');
    can('read', 'profile');
    can('edit', 'profile');
    can('read', 'projects');
    can('create', 'projects');
    can('edit', 'projects');
    can('delete', 'projects');
    can('read', 'ai');
    can('create', 'ai');
  }

  return build();
}
