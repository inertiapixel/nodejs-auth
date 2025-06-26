import { googleAuth } from './google';
import { facebookAuth } from './facebook';
import { linkedinAuth } from './linkedin';
import { getSocialConfig } from '../../config/social';

export const getSocialAuthHandlers = () => {
  const config = getSocialConfig();

  // console.log('configconfigconfig',config);

  return {
    google: config.google ? googleAuth : undefined,
    facebook: config.facebook ? facebookAuth : undefined,
    linkedin: config.linkedin ? linkedinAuth : undefined,
  };
};
