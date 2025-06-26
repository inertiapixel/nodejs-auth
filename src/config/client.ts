let clientBaseUrl: string;

export const setClientBaseUrl = (url: string) => {
  clientBaseUrl = url;
};

export const getClientBaseUrl = (): string => {
  if (!clientBaseUrl) {
    throw new Error('Client base URL is not set');
  }
  return clientBaseUrl;
};
