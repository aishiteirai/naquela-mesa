export default function PrivacidadePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6 text-neutral-800 dark:text-neutral-200">
      <h1 className="text-2xl font-semibold">Política de privacidade</h1>
      <p>
        Ao fazer um pedido, você informa nome, telefone e, se for entrega, endereço. Esses dados são usados apenas pelo restaurante
        para preparar, entregar e falar com você sobre o pedido.
      </p>
      <p>
        O restaurante é o responsável (controlador) pelos dados do seu pedido. O Naquela Mesa é a plataforma que guarda esses dados em
        nome do restaurante (operador) e não os usa para outros fins.
      </p>
      <p>A página de acompanhamento do pedido mostra apenas seu primeiro nome, os itens, o total e o andamento.</p>
      <p>Para pedir correção ou exclusão dos seus dados, fale com o restaurante pelo WhatsApp informado no cardápio.</p>
    </main>
  );
}
