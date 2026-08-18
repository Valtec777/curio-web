import { AdminMascotImageUpload } from "@/components/admin-mascot-image-upload";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { updateMascot } from "@/app/admin/actions";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const prioritySlugs = new Set(["mico-leao-dourado", "irara"]);

export default async function AdminMascotsPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("characters")
    .select("id,slug,name,species,pedagogical_trait,description,assets,active,sort_order")
    .order("sort_order");

  return <>
    <PageHeader
      eyebrow="Operação PLUMARELI"
      title="Gestão de Mascotes"
      description="Troque uma imagem uma vez e deixe o cadastro central do personagem distribuir a versão atual para o restante do Plumareli."
    />

    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>Imagens centralizadas</h2>
          <p>Mico-leão-dourado e Irara são a prioridade atual. Os demais personagens continuam exatamente com as imagens que já possuem até você decidir trocar.</p>
        </div>
      </div>
      {data?.length ? <div className="mascot-admin-grid">{data.map((character: any) => {
        const image = character.assets?.principal || character.assets?.avatar || character.assets?.sticker;
        const priority = prioritySlugs.has(character.slug);
        return <article className="mascot-admin-card" key={character.id}>
          {image ? <div className="mascot-admin-visual"><img src={image} alt={character.name} /></div> : null}
          <div className="flex space-between gap-8 wrap">
            <div className="flex gap-8 wrap">
              <Badge tone={character.active ? "green" : "neutral"}>{character.active ? "Ativo" : "Inativo"}</Badge>
              {priority ? <Badge tone="pink">Prioridade atual</Badge> : null}
            </div>
            <small className="muted">#{character.sort_order}</small>
          </div>
          <h3>{character.name}</h3>
          <p><strong>{character.pedagogical_trait}</strong><br />{character.description || character.species}</p>

          <div className="panel mt-12">
            <AdminMascotImageUpload characterId={character.id} slug={character.slug} name={character.name} />
          </div>

          <details className="mascot-settings mt-12">
            <summary>Configuração avançada</summary>
            <form action={updateMascot} className="form-stack mt-12">
              <input type="hidden" name="characterId" value={character.id} />
              <label className="checkbox-line"><input type="checkbox" name="active" defaultChecked={character.active} /> Mascote ativo</label>
              <div className="field"><label>Traço pedagógico</label><input className="input" name="trait" defaultValue={character.pedagogical_trait} required /></div>
              <div className="field"><label>Descrição</label><textarea className="textarea" name="description" defaultValue={character.description || ""} /></div>
              <div className="field"><label>Imagem principal</label><input className="input" name="principal" defaultValue={character.assets?.principal || ""} /></div>
              <div className="field"><label>Avatar</label><input className="input" name="avatar" defaultValue={character.assets?.avatar || ""} /></div>
              <div className="field"><label>Adesivo</label><input className="input" name="sticker" defaultValue={character.assets?.sticker || ""} /></div>
              <div className="field"><label>Pose de atividade</label><input className="input" name="activity" defaultValue={character.assets?.activity || ""} /></div>
              <div className="field"><label>Pose pensando</label><input className="input" name="thinking" defaultValue={character.assets?.thinking || ""} /></div>
              <button className="button button-secondary button-small" type="submit">Salvar configuração avançada</button>
            </form>
          </details>
        </article>;
      })}</div> : <EmptyState title="Nenhum mascote cadastrado" description="Os personagens oficiais do Plumareli aparecerão aqui." />}
    </section>
  </>;
}
