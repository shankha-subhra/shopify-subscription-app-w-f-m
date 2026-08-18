import { json, type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getPendingAction, confirmPendingAction } from "../services/assistant/pending-actions.server";
import { parseAssistantCommand } from "../services/assistant/command-parser.server";
import { listSubscriptionRules, searchProducts, addProductsToRule, createSubscriptionRule } from "../services/assistant/tools.server";
import { createPendingAction } from "../services/assistant/pending-actions.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const message = formData.get("message") as string;
  const conversationId = formData.get("conversationId") as string | null;
  const section = (formData.get("section") as string) || "subscription";

  if (!message) {
    return json({ error: "Message is required" }, { status: 400 });
  }

  // 1. Save user message if conversation tracking is enabled
  if (conversationId) {
    await db.assistantMessage.create({
      data: {
        conversationId,
        role: "user",
        content: message
      }
    });
  }

  // 2. Fetch context
  const rules = await listSubscriptionRules(session.shop);
  const context = {
    shop: session.shop,
    availableSubscriptionRules: rules.map(r => ({ id: r.id, name: r.name, status: r.status }))
  };

  // 3. Check for awaiting input
  let intentPayload: any = null;
  let awaitingAction = null;

  let whereClause: any = {
    shop: session.shop,
    module: section,
    status: "AWAITING_INPUT"
  };
  if (conversationId) {
    whereClause.conversationId = conversationId;
  }

  awaitingAction = await db.assistantPendingAction.findFirst({
    where: whereClause,
    orderBy: { createdAt: "desc" }
  });

    if (awaitingAction) {
      const msg = message.toLowerCase().trim();
      if (["cancel", "stop", "never mind"].includes(msg)) {
        await db.assistantPendingAction.update({
          where: { id: awaitingAction.id },
          data: { status: "CANCELLED" }
        });
        return json({
          messages: [
            {
              type: "message",
              message: "Operation cancelled. No changes were made."
            },
            {
              type: "requires_input",
              inputType: "options",
              message: "**What would you like to do with your subscription?**",
              actionId: "menu",
              data: { options: ["Add a Plan", "Add products to a Plan", "Show all active subscription rules"] }
            }
          ]
        });
      }
    }

    if (awaitingAction && awaitingAction.action === "create_subscription_rule") {
      const payload = awaitingAction.payload as any;
      const msg = message.toLowerCase().trim();
      
      if (payload.step === "waiting_for_frequency") {
        let detectedFreq = null;
        if (msg.includes("week")) detectedFreq = "Weekly";
        if (msg.includes("month")) detectedFreq = "Monthly";
        if (msg.includes("fortnight") || msg.includes("forthnight")) detectedFreq = "Fortnightly";

        if (detectedFreq) {
          payload.frequency = detectedFreq;
          payload.step = "waiting_for_discount";
          await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { payload } });
          return json({
            type: "message",
            message: "Great. What discount percentage would you like to offer for this subscription plan?\n\nEnter a percentage between 0 and 100, for example: 10"
          });
        } else {
          return json({
            type: "requires_input",
            inputType: "options",
            message: "Please choose Weekly, Fortnightly, or Monthly.",
            actionId: awaitingAction.id,
            data: { options: ["Weekly", "Fortnightly", "Monthly"] }
          });
        }
      } 
      else if (payload.step === "waiting_for_discount") {
        const match = message.match(/(\d+(?:\.\d+)?)/);
        if (match && match[1]) {
          const val = parseFloat(match[1]);
          if (val >= 0 && val <= 100) {
            payload.discount_percentage = val;
            payload.step = "waiting_for_title";
            await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { payload } });
            return json({
              type: "requires_input",
              inputType: "options",
              message: "What would you like to call this subscription plan?",
              actionId: awaitingAction.id,
              data: { options: ["Weekly Subscription", "Subscribe Subscription", "Monthly Subscription"] }
            });
          } else {
            return json({
              type: "message",
              message: "Please enter a valid discount percentage between 0 and 100."
            });
          }
        } else {
          return json({
            type: "message",
            message: "Please enter a valid discount percentage between 0 and 100."
          });
        }
      }
      else if (payload.step === "waiting_for_title") {
        payload.title = message.trim();
        payload.step = "awaiting_confirmation";
        await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { payload } });
        return json({
          type: "requires_input",
          inputType: "options",
          message: `## Subscription Plan Summary\n\n**Title:** ${payload.title}\n**Discount:** ${payload.discount_percentage}%\n**Frequency:** ${payload.frequency}\n`,
          actionId: awaitingAction.id,
          data: { options: ["Confirm & Create"] }
        });
      }
      else if (payload.step === "awaiting_confirmation") {
         if (msg === "confirm & create" || msg === "confirm" || msg === "create" || msg === "create it" || msg.startsWith("yes") || msg === "proceed" || msg === "create plan") {
            try {
              await createSubscriptionRule(session.shop, admin, {
                name: payload.title || "Untitled Plan",
                frequency: payload.frequency === "Monthly" ? "MONTH" : payload.frequency === "Weekly" ? "WEEK" : "FORTNIGHT",
                interval: 1,
                discountType: "PERCENTAGE",
                discountValue: payload.discount_percentage || 0,
              });
              await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { status: "COMPLETED" }});
              
              return json({
                type: "message",
                message: `**Subscription plan created successfully.**\n\n**What would you like to do next?**\n\nSuggestions:\n* Add products to this Plan\n* Add another Plan\n* Show all active subscription rules`
              });
            } catch (error: any) {
              return json({ type: "message", message: `Error creating plan: ${error.message}` });
            }
         } else {
            return json({ type: "message", message: "Please click 'Confirm & Create' or 'Cancel'." });
         }
      }
      else {
        // Self-heal corrupted state by cancelling it and falling through to global intent
        await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { status: "CANCELLED" } });
        awaitingAction = null;
      }
    } else if (awaitingAction && awaitingAction.action === "add_products") {
      const payload = awaitingAction.payload as any;
      const msg = message.toLowerCase().trim();

      if (payload.step === "waiting_for_plan") {
        const matchedRule = rules.find(r => r.name.toLowerCase() === msg);
        if (matchedRule) {
          payload.selected_plan_id = matchedRule.id.toString();
          payload.selected_plan_title = matchedRule.name;
          payload.step = "waiting_for_products";
          await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { payload } });
          
          const existingProductIds = matchedRule.productIds || [];
          
          return json({
            type: "requires_input",
            inputType: "product_picker",
            message: `Please select the products to add to "${payload.selected_plan_title}".`,
            actionId: awaitingAction.id,
            data: { 
              ruleName: payload.selected_plan_title,
              initialSelectionIds: existingProductIds.map((id: string) => ({ id }))
            }
          });
        } else {
          return json({
            type: "requires_input",
            inputType: "options",
            message: "Please select one of the available subscription plans.",
            actionId: awaitingAction.id,
            data: { options: [...rules.map(r => r.name)] }
          });
        }
      } 
      else if (payload.step === "waiting_for_products") {
        try {
          const parsed = JSON.parse(message);
          if (parsed.productIds && parsed.titles) {
             payload.selected_products = parsed.productIds.map((id: string, idx: number) => ({
                product_id: id,
                title: parsed.titles[idx]
             }));
             payload.step = "awaiting_product_confirmation";
             // Don't return here, let it fall through to awaiting_product_confirmation below!
          }
        } catch(e) {}

        if (payload.step !== "awaiting_product_confirmation") {
          if (msg === "search products") {
          payload.step = "waiting_for_product_search";
          await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { payload } });
          return json({
            type: "message",
            message: "Enter the product name or SKU you'd like to search for."
          });
        } else if (msg === "add all products") {
          payload.selection_type = "all_products";
          payload.step = "awaiting_product_confirmation";
        } else if (msg === "browse products") {
          // Simplistic browse flow returning the first 10 products
          const matches = await searchProducts(admin, "", 10);
          if (matches.length > 0) {
            let resultText = "Products 1-10\n\n";
            matches.forEach((m: any, i: number) => {
              resultText += `${i+1}. ${m.title}\n`;
            });
            resultText += "\nWhich products would you like to add?";
            return json({
              type: "requires_input",
              inputType: "options",
              message: resultText,
              actionId: awaitingAction.id,
              data: { options: [...matches.map((m: any) => m.title), "Done"] }
            });
          }
        } else if (msg === "done") {
          if (!payload.selected_products || payload.selected_products.length === 0) {
            return json({
              type: "requires_input",
              inputType: "options",
              message: "Please select at least one product before continuing.",
              actionId: awaitingAction.id,
              data: { options: ["Search products", "Browse products", "Add all products"] }
            });
          }
          payload.step = "awaiting_product_confirmation";
        } else if (msg.startsWith("remove ")) {
          const titleToRemove = message.substring(7).trim();
          payload.selected_products = payload.selected_products.filter((p: any) => p.title.toLowerCase() !== titleToRemove.toLowerCase());
          await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { payload } });
          return json({
            type: "requires_input",
            inputType: "options",
            message: `**${titleToRemove}** removed from your selection.\n\nSelected products: ${payload.selected_products.length}`,
            actionId: awaitingAction.id,
            data: { options: ["Add more products", "Done"] }
          });
        } else {
          // Assume user typed a product title or clicked one
          const matches = await searchProducts(admin, message, 1);
          if (matches.length > 0) {
            const p = matches[0];
            payload.selected_products = payload.selected_products || [];
            const exists = payload.selected_products.find((sp: any) => sp.product_id === p.id);
            if (exists) {
              return json({
                type: "requires_input",
                inputType: "options",
                message: "That product is already selected.",
                actionId: awaitingAction.id,
                data: { options: ["Add more products", "Done"] }
              });
            } else {
              // Check if already in the plan
              const rule = rules.find(r => r.id === payload.selected_plan_id);
              if (rule && rule.productCount > 0 && payload.selected_products.some((sp: any) => sp.product_id === p.id)) {
                 return json({
                  type: "requires_input",
                  inputType: "options",
                  message: `**${p.title}** is already part of "${payload.selected_plan_title}" and will not be added again.`,
                  actionId: awaitingAction.id,
                  data: { options: ["Add more products", "Done"] }
                });
              }

              payload.selected_products.push({ product_id: p.id, title: p.title });
              await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { payload } });
              return json({
                type: "requires_input",
                inputType: "options",
                message: `**${p.title}** added to your selection.\n\n**Selected products: ${payload.selected_products.length}**`,
                actionId: awaitingAction.id,
                data: { options: ["Add more products", "Done"] }
              });
            }
          } else {
             return json({
                type: "requires_input",
                inputType: "options",
                message: "Product not found. Please try searching or browsing.",
                actionId: awaitingAction.id,
                data: { options: ["Search products", "Browse products", "Add all products"] }
              });
          }
        }
      }
    }
    
    else if (payload.step === "waiting_for_product_search") {
        const matches = await searchProducts(admin, message, 5);
        if (matches.length > 0) {
          payload.step = "waiting_for_products";
          await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { payload } });
          
          let resultText = "I found these products:\n\n";
          matches.forEach((m: any, i: number) => {
            resultText += `${i+1}. ${m.title}\n`;
          });
          resultText += "\nWhich products would you like to add?";
          
          return json({
            type: "requires_input",
            inputType: "options",
            message: resultText,
            actionId: awaitingAction.id,
            data: { options: [...matches.map((m: any) => m.title), "Search again", "Done"] }
          });
        } else {
          return json({
            type: "message",
            message: "No products found. Enter another name or SKU."
          });
        }
      }

      if (payload.step === "awaiting_product_confirmation") {
        if (msg === "confirm & add products" || msg === "confirm") {
           let productIdsToAdd = [];
           if (payload.selection_type === "all_products") {
              const allProducts = await searchProducts(admin, "", 250);
              productIdsToAdd = allProducts.map((p:any) => p.id);
           } else {
              productIdsToAdd = payload.selected_products.map((p:any) => p.product_id);
           }
           await addProductsToRule(session.shop, admin, parseInt(payload.selected_plan_id), productIdsToAdd);
           await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { status: "COMPLETED" }});
           return json({
             messages: [
               {
                 type: "message",
                 message: `**Products added to the subscription plan successfully.**\n\nThere are now **${productIdsToAdd.length} products** in "${payload.selected_plan_title}".`
               },
               {
                 type: "requires_input",
                 inputType: "options",
                 message: "**What would you like to do next?**",
                 actionId: awaitingAction.id,
                 data: { options: ["Add more products to this Plan", "Add products to another Plan", "Show all active subscription rules", "Done"] }
               }
             ]
           });
        } else if (msg === "change products") {
           payload.step = "waiting_for_products";
           await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { payload } });
           return json({
            type: "requires_input",
            inputType: "options",
            message: `Which products would you like to add to "${payload.selected_plan_title}"?\n\nCurrently selected: ${payload.selected_products.length}`,
            actionId: awaitingAction.id,
            data: { options: ["Search products", "Browse products", "Add all products", "Done"] }
          });
        } else {
          // Render confirmation box
          await db.assistantPendingAction.update({
            where: { id: awaitingAction.id },
            data: { payload }
          });
  
          const rule = rules.find(r => r.id === payload.selected_plan_id);
          let confirmText = `## Add Products to Subscription Plan\n\n**Plan:** ${payload.selected_plan_title}\n**Frequency:** ${rule ? rule.frequencies[0] : "N/A"}\n**Discount:** ${rule ? rule.discount : "N/A"}\n\n`;
          
          if (payload.selection_type === "all_products") {
            confirmText += "**Products:** All eligible Shopify products";
          } else {
            confirmText += `**Total Products in Plan: ${payload.selected_products.length}**\n\n`;
            payload.selected_products.forEach((sp: any, i: number) => {
              confirmText += `${i+1}. ${sp.title}\n`;
            });
          }
  
          return json({
            type: "requires_input",
            inputType: "options",
            message: confirmText,
            actionId: awaitingAction.id,
            data: { options: ["Confirm & Add Products", "Change Products"] }
          });
        }
      }
      else {
        // Self-heal corrupted state by cancelling it and falling through to global intent
        await db.assistantPendingAction.update({ where: { id: awaitingAction.id }, data: { status: "CANCELLED" } });
        awaitingAction = null;
      }
    }

  // 4. Parse intent if not resuming
  try {
    if (!intentPayload) {
      intentPayload = await parseAssistantCommand({ section, message, shop: session.shop });
    }

    // 4. Handle read-only commands
    if (intentPayload.intent === "list_subscription_rules") {
      const filter = intentPayload.parameters?.filter || "ALL";
      let filteredRules = rules;
      
      if (filter === "ACTIVE") filteredRules = rules.filter(r => r.status === "ACTIVE");
      if (filter === "INACTIVE") filteredRules = rules.filter(r => r.status === "INACTIVE");

      let content = `Here are your ${filter === "ALL" ? "current" : filter.toLowerCase()} subscription rules:\n\n`;
      filteredRules.forEach(r => {
        content += `- **${r.name}** (${r.status}): ${r.productCount} products, ${r.discount} discount\n`;
      });
      return json({
        type: "message",
        message: filteredRules.length > 0 ? content : `You don't have any ${filter === "ALL" ? "" : filter.toLowerCase() + " "}subscription rules yet.`
      });
    }

    if (intentPayload.intent === "list_reviews") {
      const filter = intentPayload.parameters.filter; // "ALL", "PENDING", "APPROVED", "REJECTED"
      
      let whereClause: any = { shop: session.shop };
      if (filter && filter !== "ALL") {
        whereClause.status = filter;
      }
      if (intentPayload.parameters.rating) {
        whereClause.rating = intentPayload.parameters.rating;
      }

      const count = await db.productReview.count({ where: whereClause });

      let filterText = filter === "ALL" ? "" : filter.toLowerCase();
      let ratingText = intentPayload.parameters.rating ? ` ${intentPayload.parameters.rating}-star` : "";
      
      return json({
        type: "message",
        message: `You have **${count}** ${filterText}${ratingText} reviews in total.`
      });
    }

    if (intentPayload.intent === "list_shipping_rules") {
      const filter = intentPayload.parameters.filter || "ALL";
      let whereClause: any = { shop: session.shop };
      
      if (filter === "ACTIVE") whereClause.isActive = true;
      if (filter === "INACTIVE") whereClause.isActive = false;

      const dbRules = await db.shippingRule.findMany({ where: whereClause });
      let message = `Here are your ${filter === "ALL" ? "current" : filter.toLowerCase()} shipping rules:\n\n`;
      if (dbRules.length === 0) {
        message = `You don't have any ${filter === "ALL" ? "" : filter.toLowerCase() + " "}shipping rules yet.`;
      } else {
        dbRules.forEach((r: any) => {
          message += `- **${r.ruleName || r.shippingMethodName}**: ${r.shippingPrice} ${r.currency} (${r.isActive ? "ACTIVE" : "INACTIVE"})\n`;
        });
      }
      return json({
        type: "message",
        message
      });
    }

    if (intentPayload.intent === "check_migration_status") {
      return json({
        type: "message",
        message: `Migration Status:\n- Products: 100% Complete\n- Customers: 80% Complete\n- Orders: Pending...`
      });
    }

    if (intentPayload.intent === "unknown") {
      return json({
        type: "message",
        message: "I'm sorry, I couldn't understand that request. Could you please rephrase it?"
      });
    }

    if (intentPayload.intent === "review_settings_help") {
      return json({
        type: "message",
        message: "To change your Review Settings, please navigate to the **Review Settings** page from the main navigation menu. \n\nFrom there, you can configure:\n- Auto-publish new reviews\n- Notification emails for new reviews\n- Minimum star rating for auto-approval\n- Custom CSS for the review widget on your storefront."
      });
    }

    if (intentPayload.intent === "review_create_help") {
      return json({
        type: "message",
        message: "Customer reviews cannot be created manually from the assistant. Reviews are submitted by customers on your storefront widget.\n\nHowever, you can change your Review Settings by navigating to the **Review Settings** page from the main menu. \n\nFrom there, you can configure:\n- Auto-publish new reviews\n- Notification emails for new reviews\n- Minimum star rating for auto-approval\n- Custom CSS for the review widget."
      });
    }

    // 5. Handle write commands via pending action
    let isCreatePlanFlow = intentPayload.intent === "create_subscription_rule";
    let isAddProductsFlow = intentPayload.intent === "add_products";

    const isAwaitingInput = isCreatePlanFlow || isAddProductsFlow;

    // Handle Empty State for Add Products
    if (isAddProductsFlow && rules.length === 0) {
      return json({
        type: "requires_input",
        inputType: "options",
        message: "You don't have any active subscription plans yet. Please create a plan first.",
        data: { options: ["Add a Plan", "Cancel"] }
      });
    }

    let initialPayload = intentPayload.parameters || intentPayload;
    
    if (isAddProductsFlow) {
       if (message.toLowerCase().trim() === "add products to this plan") {
          // Find the most recently created plan for this shop
          const lastRule = await db.subscriptionRule.findFirst({
            where: { shop: { shopDomain: session.shop } },
            orderBy: { createdAt: "desc" }
          });
          
          if (lastRule) {
             initialPayload = { 
               step: "waiting_for_products", 
               selected_plan_id: lastRule.id.toString(), 
               selected_plan_title: lastRule.ruleName, 
               selected_products: [], 
               selection_type: null 
             };
          } else {
             initialPayload = { step: "waiting_for_plan", selected_plan_id: null, selected_plan_title: null, selected_products: [], selection_type: null };
          }
       } else {
         initialPayload = { step: "waiting_for_plan", selected_plan_id: null, selected_plan_title: null, selected_products: [], selection_type: null };
       }
    } else if (isCreatePlanFlow) {
       initialPayload = { step: "waiting_for_frequency", frequency: null, discount_percentage: null, title: null };
    }

    const actionData = await db.assistantPendingAction.create({
      data: {
        shop: session.shop,
        conversationId: conversationId || undefined,
        module: section,
        action: intentPayload.intent,
        payload: initialPayload,
        status: isAwaitingInput ? "AWAITING_INPUT" : "PENDING"
      }
    });

    if (isCreatePlanFlow) {
      return json({
        type: "requires_input",
        inputType: "options",
        message: "What frequency would you like for this plan?",
        actionId: actionData.id,
        data: { options: ["Weekly", "Fortnightly", "Monthly"] }
      });
    } else if (isAddProductsFlow) {
      if (initialPayload.step === "waiting_for_products") {
        const lastRule = rules.find(r => r.id === initialPayload.selected_plan_id);
        const existingProductIds = lastRule?.productIds || [];
        return json({
          type: "requires_input",
          inputType: "product_picker",
          message: `Please select the products to add to "${initialPayload.selected_plan_title}".`,
          actionId: actionData.id,
          data: { 
            ruleName: initialPayload.selected_plan_title,
            initialSelectionIds: existingProductIds.map((id: string) => ({ id }))
          }
        });
      } else {
        return json({
          type: "requires_input",
          inputType: "options",
          message: "Which subscription plan would you like to add products to?",
          actionId: actionData.id,
          data: { options: [...rules.map(r => r.name).filter(n => n.toLowerCase() !== 'cancel')] }
        });
      }
    }

    if (intentPayload.intent === "change_subscription_status" || intentPayload.intent === "change_shipping_status") {
      return json({
        type: "confirmation",
        message: `I will change the status.`,
        actionId: actionData.id,
        intent: intentPayload.intent,
        data: intentPayload.parameters
      });
    }

    if (intentPayload.intent === "add_products" || intentPayload.intent === "remove_products" || intentPayload.intent === "replace_products") {
      return json({
        type: "requires_input",
        inputType: "product_picker",
        message: `Please select the products to add to **${intentPayload.parameters.ruleName}**.`,
        actionId: actionData.id,
        intent: intentPayload.intent,
        data: intentPayload.parameters
      });
    }

    return json({
      type: "confirmation",
      message: "Please confirm this action.",
      actionId: actionData.id,
      intent: intentPayload.intent,
      data: intentPayload.parameters
    });

  } catch (error: any) {
    console.error(error);
    return json({ error: error.message }, { status: 500 });
  }
};
