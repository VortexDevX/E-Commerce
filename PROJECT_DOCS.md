# E-Commerce App - Technical Documentation

## 1. Project Overview

This project is a full-stack E-Commerce application designed to provide a seamless shopping experience for users, along with powerful tools for sellers and administrators. It features a robust backend API and a modern, responsive frontend interface.

### Key Features

- **User Shopping**: Browse products, search, filter, cart management, checkout, and order tracking.
- **Seller Portal**: Manage products, view orders, and analyze sales.
- **Admin Dashboard**: Comprehensive control over users, sellers, products, categories, coupons, and site content.
- **Authentication**: Secure JWT-based authentication for Users, Sellers, and Admins.
- **Media Management**: Cloudinary integration for efficient image storage and delivery.

## 2. Technical Stack

### Frontend (`/frontend`)

- **Framework**: [Next.js 15](https://nextjs.org/) (React 19)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **State Management**: [Redux Toolkit](https://redux-toolkit.js.org/)
- **UI Components**: Headless UI, Heroicons, Lucide React
- **Data Fetching**: Axios
- **Utilities**: Date-fns, clsx, tailwind-merge

### Backend (`/backend`)

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) (Mongoose ODM)
- **Authentication**: JWT (JSON Web Tokens), Bcrypt
- **File Storage**: Cloudinary (Multer storage)
- **Email**: Nodemailer

## 3. Project Structure

```
v:/Projects/ecommerce-app/
├── backend/                # Node.js/Express API Server
│   ├── src/
│   │   ├── config/         # DB and app configuration
│   │   ├── controllers/    # Request handlers
│   │   ├── models/         # Mongoose schemas
│   │   ├── routes/         # API route definitions
│   │   ├── middlewares/    # Auth and error handling middlewares
│   │   └── utils/          # Helper functions
│   ├── server.js           # Entry point
│   └── ...
├── frontend/               # Next.js Application
│   ├── src/
│   │   ├── app/            # Next.js App Router pages
│   │   ├── components/     # Reusable UI components
│   │   ├── redux/          # Redux slices and store
│   │   ├── types/          # TypeScript definitions
│   │   └── ...
│   ├── public/             # Static assets
│   └── ...
└── README.md               # User guide
```

## 4. Backend API Architecture

The backend provides a RESTful API with the following key resource areas:

### Authentication (`/api/auth`)

- User, Seller, and Admin login/registration.
- Password reset and token management.

### Products (`/api/products`)

- CRUD operations for products.
- Filtering, sorting, and searching logic.

### Orders (`/api/orders`)

- Order creation, payment processing integration.
- Order status updates (Processing, Shipped, Delivered).

### Users & Sellers (`/api/users`, `/api/seller`)

- Profile management.
- Seller dashboard data retrieval.

### Administration (`/api/admin`)

- **General**: `/api/admin` - Dashboard stats.
- **Emails**: `/api/admin/emails` - Manage email templates/logs.
- **Media**: `/api/admin/media` - Library management.
- **Coupons**: `/api/admin/coupons` - Discount code management.
- **Banners**: `/api/admin/banners` - Homepage banner configurations.
- **Sponsored**: `/api/admin/sponsored` - Sponsored product listings.

### Other Modules

- **Cart**: `/api/cart` - Server-side cart persistence (optional).
- **Reviews**: `/api/reviews` - Product reviews and ratings.
- **Wishlist**: `/api/wishlist` - User saved items.
- **Categories**: `/api/categories` - Product taxonomy.
- **Contact**: `/api/contact` - User inquiries.
- **Analytics**: `/api/analytics` - Sales and traffic reports.

## 5. Environment Configuration

Detailed environment variables required for the application to run.

### Backend `.env`

```env
PORT=8080
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
EMAIL_SERVICE=...
EMAIL_USER=...
EMAIL_PASS=...
FRONTEND_URL=http://localhost:3000
```

### Frontend `.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```
