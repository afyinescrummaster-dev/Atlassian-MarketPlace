import api from "@forge/api";

export const permissionStatus = (status) =>
  status === 401 || status === 403 || status === 404;

export const readJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export const requestJira = async (path, options = {}) => {
  const { headers, ...rest } = options;
  const response = await api.asUser().requestJira(path, {
    ...rest,
    headers: {
      Accept: "application/json",
      ...headers,
    },
  });

  return response;
};
