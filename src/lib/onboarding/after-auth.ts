/** Espera la cookie de sesión y manda al onboarding solo si el hogar no está listo. */
export async function pathAfterAuth(): Promise<'/onboarding' | '/dashboard'> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch('/api/onboarding');
    if (response.status === 401) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      continue;
    }
    const body = await response.json().catch(() => null);
    return body?.success && body.data?.needsOnboarding ? '/onboarding' : '/dashboard';
  }
  return '/dashboard';
}
