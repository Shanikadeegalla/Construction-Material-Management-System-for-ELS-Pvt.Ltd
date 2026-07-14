import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type: String,
      required: true,
      enum: ['Admin', 'Director', 'ProjectManager', 'PurchaseManager', 'MainStoreOfficer', 'SiteStoreOfficer'],
      default: 'MainStoreOfficer',
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    status: {
      type: Boolean,
      default: true,
    },
    firstName: {
      type: String,
      default: '',
    },
    lastName: {
      type: String,
      default: '',
    },
    username: {
      type: String,
      trim: true,
      default: '',
    },
    employeeId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', ''],
      default: '',
    },
    phone: {
      type: String,
      default: '',
    },
    alternatePhone: {
      type: String,
      default: '',
    },
    avatarUrl: {
      type: String,
      default: '/uploads/default-avatar.png',
    },
    settings: {
      system: {
        darkMode: { type: Boolean, default: false },
        notifications: {
          systemAlerts: { type: Boolean, default: true },
          emailNotifs: { type: Boolean, default: true },
          desktopNotifs: { type: Boolean, default: false }
        },
        locale: {
          language: { type: String, default: 'en' },
          timezone: { type: String, default: 'Asia/Colombo' },
          dateFormat: { type: String, default: 'YYYY-MM-DD' }
        }
      },
      profile: {
        sidebarCollapsed: { type: Boolean, default: false },
        twoFactorEnabled: { type: Boolean, default: false }
      }
    }
  },
  {
    timestamps: true,
  }
);

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Encrypt password using bcrypt before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

export default User;
