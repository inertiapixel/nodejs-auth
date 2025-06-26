import { SocialConfig } from '../types/auth';

let socialConfig: SocialConfig = {};

export const setSocialConfig = (config: SocialConfig) => {
  socialConfig = config;
};

export const getSocialConfig = (): SocialConfig => socialConfig;