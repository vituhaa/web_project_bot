import { TaskDto, UserRole } from './types';

export const create_task_data = new Map<number, {
  step: 'board_select' | 'title' | 'description' | 'confirm';
  boardId?: string;
  title?: string;
  description?: string;
}>();

export const manage_member_data = new Map<number, {
  step: 'board_select' | 'action_select' | 'name' | 'role' | 'confirm';
  boardId?: string;
  action?: 'add' | 'remove';
  name?: string;
  role?: 'ADMIN' | 'EDITOR' | 'VIEWER';
}>();


export const task_manager_data = new Map<number, {
  step: 
    | 'board_select'
    | 'task_select'
    | 'action_select'
    | 'status_select'
    | 'confirm'
    | 'title_create'
    | 'description_create'
    | 'confirm_create';
  boardId?: string;
  tasks?: TaskDto[];
  taskIndex?: number;
  action?: 'delete' | 'update' | 'create';
  newStatus?: 'TODO' | 'IN_PROGRESS' | 'DONE';
  title?: string;
  description?: string | undefined;
}>();

export const create_board_data = new Map<number, {
  step: 'name_create_board' | 'description_create_board' | 'confirm_create_board';
  name?: string;
  description?: string;
}>();

export const reg_data = new Map<number, {step: 'name' | 'password' | 'confirm';
  name?:string;
  password?:string;
}>();


export const log_data = new Map<number, {step: 'name_log' | 'password_log' | 'confirm_log';
  name?:string;
  password?:string;
}>();


export const loggedInUsers = new Map<number, {
  name?:string;
  token?: string;
  role?: UserRole;
}>();

export const userBoardsData = new Map<number, Map<number, {id: string}>>();
export const board_number_choose = new Map<number, {step: 'number'; number?:string;}>();
export const board_number_choose_delete = new Map<number, {step: 'number_delete'; number?:string;}>();
