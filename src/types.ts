export type UserRole = 'admin' | 'editor' | 'viewer';

export type BoardMemberDto = {
  userId: number;
  role: 'ADMIN' | 'EDITOR' | 'VIEWER';
  user: {
    id: number;
    name: string;
  };
  isCurrentUser: boolean;
};

export type TaskDto = {
  id?: number;
  title: string;
  description: string | null;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  createdBy?: {
    id: number;
    name: string;
  };
};