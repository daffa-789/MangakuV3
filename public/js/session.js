(() => {
  const SESSION_KEY = "manga.currentUser";
  const REDIRECT_AFTER_LOGIN_KEY = "manga.redirectAfterLogin";

  function getCurrentUserSession() {
    return window.MangakuCore.getSession(SESSION_KEY);
  }

  function setCurrentUserSession(userData) {
    window.MangakuCore.setSession(SESSION_KEY, userData);
  }

  function clearCurrentUserSession() {
    window.MangakuCore.clearSession(SESSION_KEY, [REDIRECT_AFTER_LOGIN_KEY]);
  }

  function storeRedirectAfterLogin(pathname) {
    if (!pathname) {
      return;
    }

    sessionStorage.setItem(REDIRECT_AFTER_LOGIN_KEY, pathname);
  }

  function consumeRedirectAfterLogin() {
    const pathname = sessionStorage.getItem(REDIRECT_AFTER_LOGIN_KEY);
    sessionStorage.removeItem(REDIRECT_AFTER_LOGIN_KEY);
    return pathname || "/home.html";
  }

  async function refreshCurrentUserSession() {
    const currentUser = getCurrentUserSession();

    if (!currentUser) {
      return null;
    }

    try {
      const result = await window.MangakuApi.get("/api/auth/me", {
        redirectOn401: false,
      });
      setCurrentUserSession(result.data);
      return result.data;
    } catch (error) {
      clearCurrentUserSession();
      return null;
    }
  }

  window.MangakuSession = {
    getCurrentUserSession,
    setCurrentUserSession,
    clearCurrentUserSession,
    storeRedirectAfterLogin,
    consumeRedirectAfterLogin,
    refreshCurrentUserSession,
  };
})();
