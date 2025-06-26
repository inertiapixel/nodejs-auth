export const cleanUrl = (url: string) =>
    url.replace(/([^:]\/)\/+/g, '$1');