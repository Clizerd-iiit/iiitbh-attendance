import { DefaultSession, DefaultJWT } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      userId?:             string;
      role?:               string;
      profileCompleted?:   boolean;
      verificationStatus?: string;
      profilePhotoUrl?:    string;
      isActive?:           boolean;
      isPseudoadmin?:      boolean;
      pseudoadminBranch?:  string;
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    userId?:             string;
    role?:               string;
    profileCompleted?:   boolean;
    verificationStatus?: string;
    profilePhotoUrl?:    string;
    isActive?:           boolean;
    isPseudoadmin?:      boolean;
    pseudoadminBranch?:  string;
  }
}
