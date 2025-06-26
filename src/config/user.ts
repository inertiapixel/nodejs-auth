import { I_SocialUser, I_UserObject } from '../types/auth';

let userHandler: ((user: I_SocialUser) => Promise<I_UserObject>) | undefined;

export const setUserHandler = (handler: (user: I_SocialUser) => Promise<I_UserObject>) => {
  userHandler = handler;
};

export const getUserHandler = () => {
  if (!userHandler) throw new Error('getOrCreateUser handler not set');
  return userHandler;
};
