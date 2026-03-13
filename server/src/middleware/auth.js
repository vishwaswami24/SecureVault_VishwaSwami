import { User } from "../models/User.js";
import { verifyToken } from "../services/tokenService.js";

const attachUserFromHeader = async (authorization) => {
  const [scheme, token] = (authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    return null;
  }

  const payload = verifyToken(token);
  const user = await User.findById(payload.sub).lean();

  if (!user) {
    return null;
  }

  return {
    id: user._id.toString(),
    email: user.email,
    roles: user.roles
  };
};

export const requireAuth = async (req, res, next) => {
  try {
    const user = await attachUserFromHeader(req.get("authorization"));

    if (!user) {
      return res.status(401).json({ message: "Missing bearer token" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: error.message || "Unauthorized" });
  }
};

export const optionalAuth = async (req, _res, next) => {
  try {
    const user = await attachUserFromHeader(req.get("authorization"));
    req.user = user;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};
