import { User } from "../models/User.js";
import { hashPassword, verifyPassword } from "../services/hashService.js";
import { signToken } from "../services/tokenService.js";

const buildAuthResponse = (user) => ({
  token: signToken({ sub: user._id.toString(), email: user.email, roles: user.roles }),
  user: {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    roles: user.roles,
    publicKeyJwk: user.publicKeyJwk,
    encryptedPrivateKeyBundle: user.encryptedPrivateKeyBundle
  }
});

export const register = async (req, res) => {
  const { name, email, password, publicKeyJwk, encryptedPrivateKeyBundle } = req.body;

  if (!name || !email || !password || !publicKeyJwk || !encryptedPrivateKeyBundle) {
    return res.status(400).json({ message: "Missing required registration fields" });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail }).lean();

  if (existingUser) {
    return res.status(409).json({ message: "User already exists" });
  }

  const passwordState = hashPassword(password);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: passwordState.hash,
    passwordSalt: passwordState.salt,
    passwordIterations: passwordState.iterations,
    publicKeyJwk,
    encryptedPrivateKeyBundle
  });

  res.status(201).json(buildAuthResponse(user));
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() });

  if (
    !user ||
    !verifyPassword({
      password,
      hash: user.passwordHash,
      salt: user.passwordSalt,
      iterations: user.passwordIterations
    })
  ) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  res.json(buildAuthResponse(user));
};

export const me = async (req, res) => {
  const user = await User.findById(req.user.id).lean();

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      roles: user.roles,
      publicKeyJwk: user.publicKeyJwk,
      encryptedPrivateKeyBundle: user.encryptedPrivateKeyBundle
    }
  });
};

export const directory = async (req, res) => {
  const query = (req.query.query || "").trim().toLowerCase();
  const filter = query
    ? {
        email: {
          $regex: query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          $options: "i"
        }
      }
    : {};

  const users = await User.find(filter).limit(10).select("name email publicKeyJwk").lean();

  res.json({
    users: users.map((user) => ({
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      publicKeyJwk: user.publicKeyJwk
    }))
  });
};

