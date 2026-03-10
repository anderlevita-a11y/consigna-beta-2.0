import { supabase } from './supabase';

export async function syncCatalog(previewOnly: boolean = false) {
  const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
  if (!user) throw new Error('Usuário não autenticado');

  // Fetch central products
  const { data: centralProductsData, error: centralError } = await supabase
    .from('central_products')
    .select('*');

  if (centralError) throw centralError;
  if (!centralProductsData || centralProductsData.length === 0) {
    throw new Error('A Central de Produtos está vazia.');
  }

  // Fetch user products
  const { data: userProducts, error: userProdError } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', user.id);

  if (userProdError) throw userProdError;

  // Create maps for efficient lookup
  const userEanMap = new Map();
  const userNameMap = new Map();
  
  (userProducts || []).forEach(p => {
    if (p.ean && p.ean !== '0' && p.ean !== '') {
      userEanMap.set(p.ean, p);
    }
    userNameMap.set(p.name.toLowerCase().trim(), p);
  });

  const productsToInsert = [];
  const productsToUpdate = [];
  const processedEans = new Set();
  const processedNames = new Set();
  const processedUserProductIds = new Set();

  for (const centralProduct of centralProductsData) {
    const isValidEan = centralProduct.ean && centralProduct.ean !== '0' && centralProduct.ean !== '';
    const normalizedName = centralProduct.name.toLowerCase().trim();

    if (isValidEan) {
      if (processedEans.has(centralProduct.ean)) continue;
      processedEans.add(centralProduct.ean);
    } else {
      if (processedNames.has(normalizedName)) continue;
      processedNames.add(normalizedName);
    }

    let existingProduct = null;
    
    if (isValidEan) {
      existingProduct = userEanMap.get(centralProduct.ean);
    }
    
    if (!existingProduct) {
      existingProduct = userNameMap.get(normalizedName);
    }

    if (existingProduct) {
      if (processedUserProductIds.has(existingProduct.id)) continue;
      processedUserProductIds.add(existingProduct.id);

      const hasChanged = 
        existingProduct.name !== centralProduct.name ||
        existingProduct.sale_price !== centralProduct.sale_price ||
        existingProduct.cost_price !== centralProduct.cost_price ||
        existingProduct.label_name !== centralProduct.label_name;

      if (hasChanged) {
        productsToUpdate.push({
          id: existingProduct.id,
          payload: {
            name: centralProduct.name,
            label_name: centralProduct.label_name,
            ean: isValidEan ? centralProduct.ean : null,
            cost_price: centralProduct.cost_price,
            sale_price: centralProduct.sale_price,
            photo_url: centralProduct.photo_url || existingProduct.photo_url,
            has_grid: centralProduct.has_grid
          },
          oldData: existingProduct
        });
      }
    } else {
      productsToInsert.push({
        user_id: user.id,
        name: centralProduct.name,
        label_name: centralProduct.label_name,
        ean: isValidEan ? centralProduct.ean : null,
        cost_price: centralProduct.cost_price,
        sale_price: centralProduct.sale_price,
        current_stock: 0,
        photo_url: centralProduct.photo_url,
        has_grid: centralProduct.has_grid,
        is_visible_in_store: true
      });
    }
  }

  if (previewOnly) {
    return {
      inserted: productsToInsert,
      updated: productsToUpdate
    };
  }

  if (productsToInsert.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < productsToInsert.length; i += chunkSize) {
      const chunk = productsToInsert.slice(i, i + chunkSize);
      const { error: insertError } = await supabase.from('products').insert(chunk);
      if (insertError) throw insertError;
    }
  }

  if (productsToUpdate.length > 0) {
    const chunkSize = 20;
    for (let i = 0; i < productsToUpdate.length; i += chunkSize) {
      const chunk = productsToUpdate.slice(i, i + chunkSize);
      const results = await Promise.all(chunk.map(p => 
        supabase.from('products').update(p.payload).eq('id', p.id)
      ));
      
      const firstError = results.find(r => r.error)?.error;
      if (firstError) throw firstError;
    }
  }

  return { inserted: productsToInsert.length, updated: productsToUpdate.length };
}
