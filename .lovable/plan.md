

## Plano: Fluxo "Esqueci minha senha"

### O que será feito

1. **Adicionar link "Esqueci minha senha"** na tela de Login (`Login.tsx`) abaixo do campo de senha, abrindo um formulário inline ou navegando para uma página dedicada.

2. **Criar página `ForgotPassword.tsx`** — formulário com campo de email que chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/redefinir-senha' })`. Exibe mensagem de sucesso após envio.

3. **Criar página `ResetPassword.tsx`** (`/redefinir-senha`) — verifica o token de recuperação na URL hash (`type=recovery`), exibe formulário para nova senha + confirmação, e chama `supabase.auth.updateUser({ password })`. Redireciona para `/login` após sucesso.

4. **Registrar rotas** em `App.tsx`:
   - `/esqueci-senha` → `ForgotPassword`
   - `/redefinir-senha` → `ResetPassword`

### Detalhes técnicos
- Ambas as páginas seguem o mesmo layout visual da tela de Login (centralizado, max-w-sm, branding MenuDigital)
- Textos em português, consistentes com o restante do app
- A página `/redefinir-senha` deve ser rota pública (sem proteção de auth)

