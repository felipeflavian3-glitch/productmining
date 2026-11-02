// Proteção simples por senha (usuário: qualquer, senha: PAINEL_SENHA).
// Sem PAINEL_SENHA definida (ex.: no seu PC), o painel abre direto.
import { NextResponse } from 'next/server';

export function proxy(request) {
  const senha = process.env.PAINEL_SENHA;
  if (!senha) return NextResponse.next();

  const auth = request.headers.get('authorization') || '';
  const [tipo, valor] = auth.split(' ');
  if (tipo === 'Basic' && valor) {
    const [, informada] = atob(valor).split(/:(.*)/s);
    if (informada === senha) return NextResponse.next();
  }
  return new NextResponse('Acesso restrito', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Garimpo", charset="UTF-8"' },
  });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
