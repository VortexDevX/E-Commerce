# E-Commerce Application

A modern, full-stack E-Commerce platform built with **Next.js 15** and **Node.js/Express**. This project features a polished user interface, a dedicated seller portal, and a comprehensive admin dashboard.

## 🚀 Features

- **Storefront**: Responsive design with advanced product search, filtering, and categories.
- **User Accounts**: Secure login, order history, wishlist, and profile management.
- **Shopping Cart**: Real-time cart updates and seamless checkout flow.
- **Seller Portal**: Dedicated area for vendors to manage their inventory and view sales.
- **Admin Dashboard**: Full control over products, users, orders, coupons, and content (banners, sponsored items).
- **Reviews & Ratings**: User-generated reviews for products.

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, TypeScript, TailwindCSS, Redux Toolkit.
- **Backend**: Node.js, Express, MongoDB.
- **Services**: Cloudinary (Image Hosting), Nodemailer (Emails).

## 📦 Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v16+ recommended)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ecommerce-app
```

### 2. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory with the following variables:

```env
PORT=8080
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secure_random_string
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Start the backend server:

```bash
npm run dev
# Server will start on http://localhost:8080
```

### 3. Frontend Setup

Open a new terminal, navigate to the frontend directory and install dependencies:

```bash
cd ../frontend
npm install
```

Create a `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

Start the frontend development server:

```bash
npm run dev
# App will run on http://localhost:3000
```

## 📖 Documentation

For a deep dive into the project structure, API endpoints, and architectural decisions, please refer to the [Technical Documentation](./PROJECT_DOCS.md).

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 📄 License

Distributed under the ISC License.
