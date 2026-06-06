import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const openAiApiKey = Deno.env.get("OPENAI_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getAuthToken(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  return authorization.replace(/^Bearer\s+/i, "").trim();
}

function decodeBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405, headers: corsHeaders });
  }

  try {
    const token = getAuthToken(request);
    if (!token) throw new Error("Sessao invalida.");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) throw new Error("Sessao invalida.");

    if (!openAiApiKey) {
      throw new Error("A transformacao por IA ainda nao esta configurada. Adiciona OPENAI_API_KEY aos secrets do Supabase.");
    }

    const payload = await request.formData();
    const image = payload.get("image");
    if (!(image instanceof File)) throw new Error("Fotografia em falta.");
    if (image.size > 20 * 1024 * 1024) throw new Error("A fotografia deve ter menos de 20 MB.");

    const supportedTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
    if (!supportedTypes.has(image.type)) {
      throw new Error("Usa uma fotografia PNG, JPG ou WEBP.");
    }

    const prompt = [
      "Transform this portrait photo into a cheerful, polished collectible sticker avatar.",
      "Preserve the person's recognizable facial identity, hairstyle, skin tone, expression, and key features.",
      "Use a playful modern 3D cartoon illustration style, friendly proportions, clean outlines, vibrant colors,",
      "soft studio lighting, centered head-and-shoulders composition, and a simple colorful background.",
      "Do not add text, logos, watermarks, extra people, duplicate facial features, hats, or accessories",
      "that are not visible in the source photo. The result must be suitable for a family-friendly collector album.",
    ].join(" ");

    const openAiPayload = new FormData();
    openAiPayload.append("model", "gpt-image-1.5");
    openAiPayload.append("prompt", prompt);
    openAiPayload.append("image", image, image.name || "portrait.jpg");
    openAiPayload.append("size", "1024x1536");
    openAiPayload.append("quality", "medium");
    openAiPayload.append("output_format", "png");

    const openAiResponse = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: openAiPayload,
    });
    const openAiResult = await openAiResponse.json();

    if (!openAiResponse.ok) {
      const apiMessage = String(openAiResult?.error?.message || "Erro ao transformar a fotografia.");
      throw new Error(apiMessage);
    }

    const generatedBase64 = String(openAiResult?.data?.[0]?.b64_json || "");
    if (!generatedBase64) throw new Error("A IA nao devolveu uma imagem.");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const filePath = `${authData.user.id}/avatar-ai-${Date.now()}.png`;
    const { error: uploadError } = await adminClient.storage
      .from("collector-avatars")
      .upload(filePath, decodeBase64(generatedBase64), {
        contentType: "image/png",
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = adminClient.storage.from("collector-avatars").getPublicUrl(filePath);
    const imageUrl = publicUrlData.publicUrl;
    const { error: profileError } = await adminClient
      .from("user_profiles")
      .update({
        avatar_image_url: imageUrl,
        avatar_card_created_at: new Date().toISOString(),
      })
      .eq("id", authData.user.id);
    if (profileError) throw profileError;

    return Response.json({ imageUrl }, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao criar avatar por IA.";
    return Response.json({ error: message }, { status: 400, headers: corsHeaders });
  }
});
