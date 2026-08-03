# Shopify Subscription App

A full-stack, embedded Shopify application built with Remix, Prisma, and Shopify App Bridge that allows merchants to seamlessly create, manage, and offer product subscriptions.

## Features

- **Custom Subscription Widget**: Beautiful, interactive storefront widget built as a Theme App Extension.
- **Subscription Rules & Plans**: Merchants can define flexible delivery frequencies and discount policies.
- **Dashboard Overview**: A premium, ultra-sleek analytics dashboard to track Active Plans, Contracts, and Users.
- **Advanced Shipping Rules**: Define custom shipping rates based on location (ZIP radius, country, regions), weight, and order value using the Shopify Delivery Customization API.
- **Customer Reviews System**: Full-featured product reviews with dynamic image uploads to Shopify Files, moderation dashboard, and beautiful storefront widget.
- **Seamless Checkout**: Fully integrated with Shopify's native checkout and Subscription APIs.
- **Webhooks**: Automatic background syncing for subscription contract creation and updates.

## Tech Stack

- **Framework**: [Shopify App Template - Remix](https://github.com/Shopify/shopify-app-template-remix)
- **Database**: MySQL (via Docker)
- **ORM**: Prisma
- **Styling**: Shopify Polaris & Custom CSS
- **Local Tunnel**: Ngrok

## Getting Started

### Prerequisites
- Node.js (v18+)
- Docker (for MySQL database)
- Shopify Partner Account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/shankha-subhra/shopify-subscription-app-w-f-m.git
   cd shopify-subscription-app-w-f-m
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start your database:
   ```bash
   docker-compose up -d
   ```

4. Push the database schema:
   ```bash
   npx prisma db push
   ```

### Development

To start the local development environment, you need two terminal windows:

**Terminal 1 (Ngrok Tunnel):**
```bash
npx ngrok http --url=your-ngrok-url.ngrok-free.dev 3000
```

**Terminal 2 (Shopify Dev Server):**
```bash
npm run dev -- --use-localhost
```

## Contact & Support

**Maintained by:**
- **Name:** Shankha Subhra Bag
- **Email:** shankha4030@gmail.com
- **Phone:** +919674364030

Please feel free to reach out via email for any inquiries or support requests regarding this application.

## License

This project is proprietary and confidential. Please contact the author for licensing details.
