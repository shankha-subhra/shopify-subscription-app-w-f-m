import {
  Page,
  Layout,
  Card,
  IndexTable,
  Badge,
  Button,
  ButtonGroup,
  Text,
  useIndexResourceState,
  BlockStack,
  Modal,
  TextField,
  Select,
  FormLayout,
} from "@shopify/polaris";
import { type LoaderFunctionArgs, json, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const reviews = await prisma.productReview.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    include: { images: true }
  });
  return json({ reviews });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const id = parseInt(formData.get("id") as string, 10);
  const status = formData.get("status") as string;
  const _action = formData.get("_action") as string;
  
  if (_action === "updateStatus" && id && status) {
    await prisma.productReview.update({
      where: { id },
      data: { status: status as any }
    });
    return json({ success: true });
  }

  if (_action === "edit" && id) {
    const customerName = formData.get("customerName") as string;
    const customerEmail = formData.get("customerEmail") as string;
    const title = formData.get("title") as string;
    const comment = formData.get("comment") as string;
    const rating = parseInt(formData.get("rating") as string, 10);
    
    await prisma.productReview.update({
      where: { id },
      data: { customerName, customerEmail, title, comment, rating }
    });
    return json({ success: true, action: "edit" });
  }

  if (_action === "delete" && id) {
     await prisma.productReview.delete({ where: { id }});
     return json({ success: true });
  }
  
  return json({ success: false }, { status: 400 });
};

export default function CustomerReviews() {
  const { reviews } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [editingReview, setEditingReview] = useState<any>(null);

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.action === "edit" && fetcher.state === "idle") {
      setEditingReview(null);
      shopify.toast.show("Review updated successfully");
    }
  }, [fetcher.data, fetcher.state]);

  const handleEdit = (review: any) => {
    setEditingReview(review);
  };
  const handleEditClose = () => setEditingReview(null);

  const handleStatusChange = (id: number, status: string) => {
    fetcher.submit(
      { _action: "updateStatus", id: id.toString(), status },
      { method: "POST" }
    );
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this review?")) {
      fetcher.submit(
        { _action: "delete", id: id.toString() },
        { method: "POST" }
      );
    }
  };

  const resourceName = { singular: "review", plural: "reviews" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(reviews);

  const rowMarkup = reviews.map((review, index) => (
    <IndexTable.Row
      id={review.id.toString()}
      key={review.id}
      selected={selectedResources.includes(review.id.toString())}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">{review.customerName}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{review.rating} Stars</IndexTable.Cell>
      <IndexTable.Cell>
        <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {review.comment}
        </div>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={review.status === "APPROVED" ? "success" : review.status === "REJECTED" ? "critical" : "warning"}>
          {review.status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
         <ButtonGroup>
            <Button size="micro" onClick={() => handleEdit(review)}>Edit</Button>
            {review.status !== "APPROVED" && (
              <Button size="micro" onClick={() => handleStatusChange(review.id, "APPROVED")}>Approve</Button>
            )}
            {review.status !== "REJECTED" && (
              <Button size="micro" onClick={() => handleStatusChange(review.id, "REJECTED")} tone="critical">Reject</Button>
            )}
            <Button size="micro" onClick={() => handleDelete(review.id)}>Delete</Button>
         </ButtonGroup>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Customer Reviews" subtitle="Manage and moderate product reviews.">
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexTable
              resourceName={resourceName}
              itemCount={reviews.length}
              selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
              onSelectionChange={handleSelectionChange}
              headings={[
                { title: "Customer" },
                { title: "Rating" },
                { title: "Comment" },
                { title: "Status" },
                { title: "Actions" },
              ]}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">How to show Customer Reviews on your store</Text>
              <Text variant="bodyMd" as="p">
                To display the Customer Reviews and the submission form on your product pages, you need to add the App Block in your Shopify Theme Editor:
              </Text>
              <ol style={{ paddingLeft: '20px', margin: 0 }}>
                <li>Go to <strong>Online Store</strong> &gt; <strong>Themes</strong> in your Shopify Admin.</li>
                <li>Click <strong>Customize</strong> on your current theme.</li>
                <li>Navigate to a <strong>Product page</strong> using the dropdown at the top center.</li>
                <li>In the left sidebar, click <strong>Add section</strong> or <strong>Add block</strong> and look for <strong>Apps</strong>.</li>
                <li>Select the <strong>Customer Reviews</strong> block and drag it to your desired location (e.g., below the product description).</li>
                <li>Click <strong>Save</strong> in the top right corner.</li>
              </ol>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {editingReview && (
        <Modal
          open={true}
          onClose={handleEditClose}
          title="Edit Review"
          primaryAction={{
            content: "Save",
            onAction: () => {
              const form = document.getElementById("edit-review-form") as HTMLFormElement;
              if (form) fetcher.submit(form, { method: "POST" });
            },
            loading: fetcher.state === "submitting"
          }}
          secondaryActions={[{ content: "Cancel", onAction: handleEditClose }]}
        >
          <Modal.Section>
            <form id="edit-review-form">
              <input type="hidden" name="_action" value="edit" />
              <input type="hidden" name="id" value={editingReview.id} />
              <FormLayout>
                <FormLayout.Group>
                  <TextField label="Customer Name" name="customerName" value={editingReview.customerName} onChange={(val) => setEditingReview({...editingReview, customerName: val})} autoComplete="off" />
                  <TextField label="Customer Email" name="customerEmail" value={editingReview.customerEmail} onChange={(val) => setEditingReview({...editingReview, customerEmail: val})} autoComplete="off" />
                </FormLayout.Group>
                <Select
                  label="Rating"
                  name="rating"
                  options={[
                    {label: '5 Stars', value: '5'},
                    {label: '4 Stars', value: '4'},
                    {label: '3 Stars', value: '3'},
                    {label: '2 Stars', value: '2'},
                    {label: '1 Star', value: '1'}
                  ]}
                  value={editingReview.rating.toString()}
                  onChange={(val) => setEditingReview({...editingReview, rating: parseInt(val, 10)})}
                />
                <TextField label="Title" name="title" value={editingReview.title || ''} onChange={(val) => setEditingReview({...editingReview, title: val})} autoComplete="off" />
                <TextField label="Comment" name="comment" value={editingReview.comment} onChange={(val) => setEditingReview({...editingReview, comment: val})} multiline={4} autoComplete="off" />
              </FormLayout>
            </form>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
