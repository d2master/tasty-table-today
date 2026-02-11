import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Smartphone, BarChart3, Utensils, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-image.jpg";

const features = [
  { icon: Smartphone, title: "Cardápio Digital", desc: "Seu cardápio online acessível por QR Code ou link direto" },
  { icon: BarChart3, title: "Gestão de Pedidos", desc: "Receba e gerencie pedidos em tempo real no painel" },
  { icon: Utensils, title: "Multi-categorias", desc: "Organize seus produtos por categorias personalizadas" },
  { icon: Shield, title: "Seguro & Isolado", desc: "Cada lanchonete tem seus dados 100% protegidos" },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="font-display text-xl font-bold text-primary">
            🍔 MenuDigital
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/cadastro">
              <Button size="sm">Criar Conta</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container py-16 md:py-24 flex flex-col md:flex-row items-center gap-10">
          <motion.div
            className="flex-1 space-y-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight text-foreground">
              Seu cardápio digital <span className="text-primary">pronto em minutos</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg">
              Crie o cardápio online da sua lanchonete, receba pedidos em tempo real
              e gerencie tudo pelo painel administrativo.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/cadastro">
                <Button size="lg" className="gap-2">
                  Começar Agora <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/cardapio/demo">
                <Button size="lg" variant="outline">
                  Ver Demo
                </Button>
              </Link>
            </div>
          </motion.div>
          <motion.div
            className="flex-1"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <img
              src={heroImage}
              alt="Cardápio digital em smartphone e desktop"
              className="rounded-2xl shadow-2xl w-full max-w-lg mx-auto"
            />
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-secondary/30">
        <div className="container">
          <h2 className="text-3xl font-display font-bold text-center mb-12">
            Tudo que sua lanchonete precisa
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="p-6 rounded-xl bg-card shadow-sm border hover:shadow-md transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="container text-center space-y-6">
          <h2 className="text-3xl font-display font-bold">
            Pronto para digitalizar seu cardápio?
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Cadastre-se gratuitamente e comece a receber pedidos online hoje mesmo.
          </p>
          <Link to="/cadastro">
            <Button size="lg" className="gap-2">
              Criar Minha Conta <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2026 MenuDigital. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
};

export default Index;
