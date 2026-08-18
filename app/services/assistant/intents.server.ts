import { z } from "zod";

export const CreateSubscriptionRuleSchema = z.object({
  intent: z.literal("create_subscription_rule"),
  name: z.string().optional(),
  frequency: z.enum(["DAY", "WEEK", "MONTH"]).optional(),
  interval: z.number().optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]).optional(),
  discountValue: z.number().optional(),
});

export const AddProductsSchema = z.object({
  intent: z.literal("add_products"),
  ruleId: z.string().optional(),
  ruleName: z.string().optional(),
  productIds: z.array(z.string()).optional(),
  productQuery: z.string().optional(),
});

export const RemoveProductsSchema = z.object({
  intent: z.literal("remove_products"),
  ruleId: z.string().optional(),
  ruleName: z.string().optional(),
  productIds: z.array(z.string()).optional(),
});

export const ReplaceProductsSchema = z.object({
  intent: z.literal("replace_products"),
  ruleId: z.string().optional(),
  ruleName: z.string().optional(),
  productIds: z.array(z.string()).optional(),
});

export const ChangeSubscriptionStatusSchema = z.object({
  intent: z.literal("change_subscription_status"),
  ruleId: z.string().optional(),
  ruleName: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const ListSubscriptionRulesSchema = z.object({
  intent: z.literal("list_subscription_rules"),
});

export const UnknownIntentSchema = z.object({
  intent: z.literal("unknown"),
  message: z.string().optional(),
});

export const AssistantIntentSchema = z.discriminatedUnion("intent", [
  CreateSubscriptionRuleSchema,
  AddProductsSchema,
  RemoveProductsSchema,
  ReplaceProductsSchema,
  ChangeSubscriptionStatusSchema,
  ListSubscriptionRulesSchema,
  UnknownIntentSchema,
]);

export type AssistantIntent = z.infer<typeof AssistantIntentSchema>;
